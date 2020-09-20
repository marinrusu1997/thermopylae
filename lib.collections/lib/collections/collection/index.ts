import { Mapper, Nullable, ObjMap, Optional, UnaryPredicate, Undefinable } from '@thermopylae/core.declarations';
import { Observable, Subject } from 'rxjs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { JSONSchema } from 'json-schema-typed';
import Ajv from 'ajv';
// @ts-ignore
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import dotprop from 'dot-prop';
import { IndexedStore, IndexValue, PRIMARY_KEY_INDEX } from '../indexed-store';
import { createError, ErrorCodes } from '../../error';
import {
	DeleteCriteria,
	DocumentContract,
	FindCriteria,
	IndexedKey,
	MapReduceCriteria,
	Query,
	ReplaceCriteria,
	UpdateCriteria,
	Projection,
	ProjectionType,
	QueryConditions
} from './typings';
import { Processor } from './processor';
import { Retriever } from './retriever';

type Cursor<Document> = Iterator<Document>;

const enum DocumentIdentity {
	CLONE,
	ORIGINAL
}

const enum DocumentOperation {
	CREATED = 'created',
	UPDATED = 'updated',
	DELETED = 'deleted'
}

interface DocumentNotification<Document> {
	action: DocumentOperation;
	documents: ReadonlyArray<Document>;
}

interface CollectionOptions<Document> {
	indexKeys: ReadonlyArray<IndexedKey<Document>>;
	schema: JSONSchema;
	documentsIdentity: DocumentIdentity;
}

/**
 * Collection of volatile documents which are kept indexed in process memory.
 *
 * @template {Document}
 */
class Collection<Document extends DocumentContract<Document>> implements Iterable<Document> {
	private readonly storage: IndexedStore<Document>;

	private readonly notifier: Subject<DocumentNotification<Document>>;

	private readonly identity: DocumentIdentity;

	private readonly validator: Nullable<Ajv.Ajv>;

	public constructor(options?: Partial<CollectionOptions<Document>>) {
		options = options || {};

		this.storage = new IndexedStore<Document>({ indexes: options.indexKeys });
		this.notifier = new Subject<DocumentNotification<Document>>();
		this.identity = options.documentsIdentity != null ? options.documentsIdentity : DocumentIdentity.ORIGINAL;

		if (options.schema) {
			this.validator = new Ajv({ allErrors: true });
			this.validator.addSchema(options.schema, Collection.constructor.name);
		} else {
			this.validator = null;
		}
	}

	public get indexes(): ReadonlyArray<IndexedKey<Document>> {
		return this.storage.indexes;
	}

	public insert(...documents: Array<Document>): void {
		if (this.validator) {
			Collection.validateDocuments(this.validator, documents);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			documents = Processor.clone(documents);
		}

		this.storage.insert(...documents);

		this.notifier.next({
			action: DocumentOperation.CREATED,
			documents
		});
	}

	public find(query?: Nullable<Query<Document>>, criteria?: Partial<FindCriteria<Document>>): Array<Document> {
		return Retriever.retrieve(this.storage, query, criteria);
	}

	public replace(query: Query<Document>, replacement: Document, criteria?: Partial<ReplaceCriteria<Document>>): Array<Document> {
		const matches = this.findAndDelete(query, criteria);

		if (matches.length || (matches.length === 0 && criteria && criteria.upsert)) {
			this.insert(replacement);
		}

		return matches;
	}

	public update(query: Query<Document>, update: ObjMap, criteria?: Partial<UpdateCriteria<Document>>): Array<Document> {
		const matches = this.find(query, criteria);

		let original: Array<Document>;
		if (!(criteria && criteria.returnUpdates)) {
			original = Processor.clone(matches);
		}

		Processor.update(matches, update, this.storage);

		this.notifier.next({
			action: DocumentOperation.UPDATED,
			documents: matches
		});

		return original! || matches;
	}

	public delete(query: Query<Document>, criteria?: Partial<DeleteCriteria<Document>>): Array<Document> {
		return this.findAndDelete(query, criteria);
	}

	public get count(): number {
		return this.storage.size;
	}

	public clear(): void {
		this.storage.clear();
	}

	public drop(): void {
		this.clear();
		this.notifier.complete();
	}

	public distinct(field: IndexedKey<Document>, query?: Query<Document>, criteria?: Partial<FindCriteria<Document>>): Set<IndexValue> {
		if (field === PRIMARY_KEY_INDEX) {
			throw createError(ErrorCodes.NOT_ALLOWED, `All of the documents are distinct based in their primary key '${field}'.`);
		}

		const candidates = Retriever.retrieve(this.storage, query, criteria);

		const distinctValues = new Set<IndexValue>();

		let value: Optional<IndexValue>;
		for (const candidate of candidates) {
			if ((value = dotprop.get(candidate, field)) != null) {
				distinctValues.add(value);
			}
		}

		return distinctValues;
	}

	public mapReduce<MappedDocument>(
		mapper: Mapper<Document, MappedDocument>,
		filter?: UnaryPredicate<MappedDocument>,
		criteria?: Partial<MapReduceCriteria<Document>>
	): ReadonlyArray<MappedDocument> {
		if (criteria == null) {
			criteria = {};
		}

		let onIndex: Undefinable<IndexedKey<Document>>;
		let withValue: Undefinable<IndexValue>;
		if (criteria.hint) {
			onIndex = criteria.hint.index;
			withValue = criteria.hint.value;
		}

		let transformations = this.storage.map(mapper, onIndex, withValue);

		if (filter != null) {
			transformations = transformations.filter(filter);
		}

		return transformations;
	}

	public watch(): Observable<DocumentNotification<Document>> {
		return this.notifier.asObservable();
	}

	public createIndexes(...indexes: Array<IndexedKey<Document>>): void {
		this.storage.createIndexes(indexes);
	}

	public dropIndexes(...indexes: Array<IndexedKey<Document>>): void {
		if (!indexes.length) {
			return this.storage.dropIndexes();
		}

		let i = indexes.length;
		while (i--) {
			this.storage.dropIndex(indexes[i]);
		}
	}

	public ensureIndex(index: IndexedKey<Document>): void {
		if (!this.storage.containsIndex(index)) {
			this.createIndexes(index);
		}
	}

	[Symbol.iterator](): Cursor<Document> {
		return this.storage[Symbol.iterator]();
	}

	private findAndDelete(query: Query<Document>, criteria?: Partial<FindCriteria<Document>>): Array<Document> {
		const matches = this.find(query, criteria);

		if (matches.length) {
			for (let i = 0; i < matches.length; i++) {
				this.storage.remove(PRIMARY_KEY_INDEX, matches[i][PRIMARY_KEY_INDEX]);
			}

			this.notifier.next({
				action: DocumentOperation.DELETED,
				documents: matches
			});
		}

		return matches;
	}

	private static validateDocuments<Document>(validator: Ajv.Ajv, documents: ReadonlyArray<Document>): void | never {
		for (const document of documents) {
			if (!validator.validate(Collection.constructor.name, document)) {
				AjvLocalizeEn(validator.errors);
				throw createError(ErrorCodes.INVALID_TYPE, validator.errorsText(validator.errors, { separator: '\n' }), document);
			}
		}
	}
}

export {
	Collection,
	DocumentIdentity,
	DocumentNotification,
	DocumentOperation,
	DocumentContract,
	Query,
	FindCriteria,
	Projection,
	ProjectionType,
	QueryConditions
};
