import { Mapper, Nullable, ObjMap, Optional } from '@thermopylae/core.declarations';
import createSubject, { Subject, Subscribable } from 'rx-subject';
// eslint-disable-next-line import/no-extraneous-dependencies
import { JSONSchema } from 'json-schema-typed';
import Ajv from 'ajv';
// @ts-ignore
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import { IndexedStore, PRIMARY_KEY_INDEX } from '../indexed-store';
import { createException, ErrorCodes } from '../../error';
import {
	DeleteCriteria,
	DocumentContract,
	FindCriteria,
	IndexCriteria,
	IndexedKey,
	Projection,
	ProjectionType,
	Query,
	QueryConditions,
	ReplaceCriteria,
	UpdateCriteria
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
	DELETED = 'deleted',
	CLEARED = 'cleared'
}

interface DocumentNotification<Document> {
	action: DocumentOperation;
	documents: ReadonlyArray<Document>;
}

interface CollectionOptions<Document> {
	indexKeys: ReadonlyArray<IndexedKey<Document>>;
	schema: JSONSchema;
	documentsIdentity: DocumentIdentity;
	validateQueries: boolean;
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

	private readonly retriever: Retriever<Document>;

	private readonly processor: Processor<Document>;

	public constructor(options?: Partial<CollectionOptions<Document>>) {
		options = options || {};

		this.storage = new IndexedStore<Document>({ indexes: options.indexKeys });
		this.notifier = createSubject<DocumentNotification<Document>>();
		this.identity = options.documentsIdentity != null ? options.documentsIdentity : DocumentIdentity.ORIGINAL;

		this.retriever = new Retriever<Document>(this.storage, options.validateQueries);
		this.processor = new Processor<Document>(this.storage, options.validateQueries);

		if (options.schema) {
			this.validator = new Ajv({ allErrors: true });
			this.validator.addSchema(options.schema, Collection.constructor.name);
		} else {
			this.validator = null;
		}
	}

	public get indexes(): Array<IndexedKey<Document>> {
		return this.storage.indexes;
	}

	public insert(documents: Document | Array<Document>): void {
		if (!Array.isArray(documents)) {
			documents = [documents];
		}

		if (this.validator) {
			Collection.validateDocuments(this.validator, documents);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			documents = Processor.clone(documents);
		}

		this.storage.insert(documents);

		this.notifier.sink.next({
			action: DocumentOperation.CREATED,
			documents
		});
	}

	public find(query?: Nullable<Query<Document>>, criteria?: Partial<FindCriteria<Document>>): Array<Document> {
		return this.retriever.retrieve(query, criteria);
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

		let original: Optional<Array<Document>>;
		if (!(criteria && criteria.returnUpdates)) {
			original = Processor.clone(matches);
		}

		this.processor.update(matches, update);

		this.notifier.sink.next({
			action: DocumentOperation.UPDATED,
			documents: matches
		});

		return original || matches;
	}

	public delete(query: Query<Document>, criteria?: Partial<DeleteCriteria<Document>>): Array<Document> {
		return this.findAndDelete(query, criteria);
	}

	public get count(): number {
		return this.storage.size;
	}

	public clear(): void {
		this.storage.clear();
		this.notifier.sink.next({
			action: DocumentOperation.CLEARED,
			// @ts-ignore
			documents: null
		});
	}

	public drop(): void {
		this.clear();
		if (this.notifier.sink.complete != null) {
			this.notifier.sink.complete();
		}
	}

	// FIXME aggregate

	public map<MappedDocument>(mapper: Mapper<Document, MappedDocument>, criteria?: Partial<IndexCriteria<Document>>): Array<MappedDocument> {
		if (criteria == null || criteria.index == null) {
			return this.storage.map(mapper);
		}

		return this.storage.map(mapper, criteria.index.key, criteria.index.value);
	}

	public watch(): Subscribable<DocumentNotification<Document>> {
		return this.notifier.source$;
	}

	public createIndexes(...indexes: Array<IndexedKey<Document>>): void {
		this.storage.createIndexes(indexes);
	}

	public createIndexIfMissing(index: IndexedKey<Document>): boolean {
		if (!this.storage.containsIndex(index)) {
			this.createIndexes(index);
			return true;
		}
		return false;
	}

	public dropIndexes(...indexes: Array<IndexedKey<Document>>): void {
		if (!indexes.length) {
			this.storage.dropIndexes();
			return;
		}

		for (const index of indexes) {
			this.storage.dropIndex(index);
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

			this.notifier.sink.next({
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
				throw createException(ErrorCodes.INVALID_TYPE, validator.errorsText(validator.errors, { separator: '\n' }), document);
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
