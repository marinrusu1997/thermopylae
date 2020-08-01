import {
	Cloneable,
	ComparisonResult,
	Mapper,
	Nullable,
	ObjMap,
	Optional,
	PersistablePrimitive,
	SortDirection,
	UnaryPredicate,
	Undefinable
} from '@thermopylae/core.declarations';
import { Observable, Subject } from 'rxjs';
import sorter from 'thenby';
// @ts-ignore
import MongooseFilter from 'filtr';
// @ts-ignore
import mongoQuery from 'mongo-query';
// eslint-disable-next-line import/no-extraneous-dependencies
import { JSONSchema } from 'json-schema-typed';
// eslint-disable-next-line import/no-unresolved
import { QueryConditions } from '@b4dnewz/mongodb-operators';
import Ajv from 'ajv';
// @ts-ignore
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import dotprop from 'dot-prop';
import { IndexedStore, IndexName, IndexValue, PRIMARY_KEY_INDEX } from './indexed-store';
import { createError, ErrorCodes } from '../error';

type KeyOf<Document> = Exclude<keyof Document, symbol | number>;
type IndexedKey<Document> = KeyOf<Document> | string;

type Cursor<Document> = Iterator<Document>;
type SortFields<Document> = Record<IndexedKey<Document>, SortDirection>;

type Query<Document> = QueryConditions<Document> | UnaryPredicate<Document>;

const enum ProjectionType {
	EXCLUDE,
	INCLUDE
}

const enum DocumentIdentity {
	CLONE,
	ORIGINAL
}

const enum DocumentOperation {
	CREATED = 'created',
	UPDATED = 'updated',
	DELETED = 'deleted'
}

const enum AlterationType {
	SET = '$set',
	INC = '$inc',
	POP = '$pop',
	RENAME = '$rename',
	PUSH = '$push',
	PUSH_ALL = '$pushAll',
	PULL = '$pull',
	PULL_ALL = '$pullAll',
	UNSET = '$unset',
	ADD_TO_SET = '$addToSet'
}

interface Alteration<Document> {
	key: IndexedKey<Document>;
	op: AlterationType;
	value?: PersistablePrimitive | Array<PersistablePrimitive>;
	shift?: boolean;
}

interface DocumentContract<DocType> extends Cloneable<DocType> {
	readonly [PRIMARY_KEY_INDEX]: IndexValue;
}

interface DocumentNotification<Document> {
	action: DocumentOperation;
	documents: ReadonlyArray<Document>;
}

interface Hint<Document> {
	index: IndexedKey<Document>;
	value?: IndexValue;
}

interface Projection<Document> {
	type: ProjectionType;
	fields: ReadonlyArray<IndexedKey<Document>>;
}

interface FindCriteria<Document> {
	multiple: boolean;
	sort: SortFields<Document>;
	hint: Hint<Document>;
	projection: Projection<Document>;
}

interface ReplaceCriteria<Document> extends FindCriteria<Document> {
	upsert: boolean;
}

interface UpdateCriteria<Document> extends FindCriteria<Document> {
	returnUpdates: boolean;
}

interface MapReduceCriteria<Document> {
	hint: Hint<Document>;
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
	private static readonly RE_INDEXABLE_ALTERATIONS = new Set([AlterationType.SET, AlterationType.INC, AlterationType.RENAME, AlterationType.UNSET]);

	private readonly storage: IndexedStore<Document>;

	private readonly notifier: Subject<DocumentNotification<Document>>;

	private readonly identity: DocumentIdentity;

	private readonly validator: Nullable<Ajv.Ajv>;

	public constructor(options?: Partial<CollectionOptions<Document>>) {
		options = options || {};

		this.storage = new IndexedStore<Document>({ indexes: options.indexKeys });
		this.notifier = new Subject<DocumentNotification<Document>>();
		this.identity = options.documentsIdentity ?? DocumentIdentity.ORIGINAL;

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

	public insert(...documents: ReadonlyArray<Document>): void {
		if (this.validator) {
			Collection.validateDocuments(this.validator, documents);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			documents = Collection.clone(documents);
		}

		this.storage.insert(...documents);

		this.notifier.next({
			action: DocumentOperation.CREATED,
			documents
		});
	}

	public find(query: Query<Document>, criteria?: Partial<FindCriteria<Document>>): ReadonlyArray<Document> {
		const matches = this.retrieveMatches(query, criteria);

		if (criteria && criteria.projection) {
			return Collection.project(matches, criteria.projection);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			return Collection.clone(matches);
		}

		return matches;
	}

	public replace(query: Query<Document>, replacement: Document, criteria?: Partial<ReplaceCriteria<Document>>): ReadonlyArray<Document> {
		let matches = this.findAndDelete(query, criteria);

		this.insert(replacement);

		if (criteria && criteria.projection) {
			matches = Collection.project(matches, criteria.projection);
		}

		return matches;
	}

	public update(query: Query<Document>, update: ObjMap, criteria?: Partial<UpdateCriteria<Document>>): ReadonlyArray<Document> {
		if (criteria == null) {
			criteria = {};
		}

		let matches: Nullable<ReadonlyArray<Document>> = this.retrieveAlterationCandidates(query, criteria);
		if (matches == null) {
			return [];
		}

		if (!criteria.multiple) {
			matches = matches.slice(0, 1);
		}

		const { indexes } = this;

		let original: Undefinable<ReadonlyArray<Document>>;

		if (criteria.returnUpdates === false) {
			original = Collection.clone(matches);
		}

		for (const match of matches) {
			Collection.updateDocument(match, update, this.storage, indexes);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			matches = Collection.clone(matches);
		}

		this.notifier.next({
			action: DocumentOperation.UPDATED,
			documents: matches
		});

		matches = original || matches;

		if (criteria && criteria.projection) {
			matches = Collection.project(matches, criteria.projection);
		}

		return matches;
	}

	public delete(query: Query<Document>, criteria?: Partial<FindCriteria<Document>>): ReadonlyArray<Document> {
		let matches = this.findAndDelete(query, criteria);

		if (criteria && criteria.projection) {
			matches = Collection.project(matches, criteria.projection);
		}

		return matches;
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

		const candidates = this.retrieveMatches(query, criteria);

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

	private retrieveFirstMatch(query: Query<Document>, criteria?: Partial<FindCriteria<Document>>): Optional<Document> {
		let onIndex: Undefinable<IndexName<Document>>;
		let withValue: Undefinable<IndexValue>;
		if (criteria && criteria.hint) {
			onIndex = criteria.hint.index;
			withValue = criteria.hint.value;
		}

		return this.storage.find(Collection.queryToPredicate(query), onIndex, withValue);
	}

	private retrieveMatches(query?: Query<Document>, criteria?: Partial<FindCriteria<Document>>): Array<Document> {
		if (query == null) {
			return this.storage.values;
		}

		let onIndex: Optional<IndexName<Document>>;
		let withValue: IndexValue;
		if (criteria && criteria.hint) {
			onIndex = criteria.hint.index;
			withValue = criteria.hint.value;
		}

		return this.storage.filter(Collection.queryToPredicate(query), onIndex, withValue);
	}

	private retrieveAlterationCandidates(
		query: Query<Document>,
		criteria: Partial<FindCriteria<Document>>,
		replacement?: Document
	): Nullable<ReadonlyArray<Document>> {
		let matches: Array<Document>;
		if (criteria.multiple || criteria.sort) {
			matches = this.retrieveMatches(query, criteria);
		} else {
			const match = this.retrieveFirstMatch(query, criteria);
			matches = match == null ? [] : [match];
		}

		if (matches.length === 0) {
			if (replacement != null) {
				this.insert(replacement);
			}
			return null;
		}

		if (criteria.sort) {
			matches = Collection.sort(matches, criteria.sort);
		}

		return matches;
	}

	private findAndDelete(query: Query<Document>, criteria?: Partial<FindCriteria<Document>>): ReadonlyArray<Document> {
		if (criteria == null) {
			criteria = {};
		}

		let matches: Nullable<ReadonlyArray<Document>> = this.retrieveAlterationCandidates(query, criteria);
		if (matches == null) {
			return [];
		}

		if (!criteria.multiple) {
			matches = matches.slice(0, 1);
		}

		for (let i = 0; i < matches.length; i++) {
			this.storage.remove(PRIMARY_KEY_INDEX, matches[i][PRIMARY_KEY_INDEX]);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			matches = Collection.clone(matches);
		}

		this.notifier.next({
			action: DocumentOperation.DELETED,
			documents: matches
		});

		return matches;
	}

	private static queryToPredicate<Document>(query: Query<Document>): UnaryPredicate<Document> {
		if (query instanceof Function) {
			return query;
		}

		const filter = new MongooseFilter(query);
		if (filter == null || filter.test == null) {
			throw createError(ErrorCodes.INVALID_QUERY, `Query must conform to mongoose standard. Given: ${JSON.stringify(query)}.`);
		}

		const testOptions = { type: 'single' };
		return function predicate(document: Document): boolean {
			return filter.test(document, testOptions);
		};
	}

	private static project<Document extends DocumentContract<Document>>(
		matches: ReadonlyArray<Document>,
		projection: Projection<Document>
	): ReadonlyArray<Document> {
		return matches.map((document) => Collection.applyProjection(document.clone(), projection));
	}

	private static clone<Document extends DocumentContract<Document>>(matches: ReadonlyArray<Document>): ReadonlyArray<Document> {
		return matches.map((document) => document.clone());
	}

	private static sort<Document extends DocumentContract<Document>>(matches: Array<Document>, sortFields: SortFields<Document>): Array<Document> {
		const fields = Object.keys(sortFields);
		if (fields.length === 0) {
			return matches;
		}

		let fieldIndex = 0;

		const comparator = sorter.firstBy(
			(first: Document, second: Document): ComparisonResult =>
				Collection.compareDocuments(first, second, fields[fieldIndex], sortFields[fields[fieldIndex]])
		);

		for (++fieldIndex; fieldIndex < fields.length; fieldIndex++) {
			comparator.thenBy(
				// eslint-disable-next-line no-loop-func
				(first: Document, second: Document): ComparisonResult =>
					Collection.compareDocuments(first, second, fields[fieldIndex], sortFields[fields[fieldIndex]])
			);
		}

		return matches.sort(comparator);
	}

	private static compareDocuments<Document extends DocumentContract<Document>>(
		first: Document,
		second: Document,
		field: IndexedKey<Document>,
		direction: SortDirection
	): ComparisonResult {
		switch (direction) {
			case SortDirection.ASCENDING:
				return Collection.compareFields(first, second, field);
			case SortDirection.DESCENDING:
				return Collection.compareFields(second, first, field);
			default:
				throw createError(ErrorCodes.UNKNOWN, `Sort direction ${direction} for field ${field} can't be processed.`);
		}
	}

	private static compareFields<Document extends DocumentContract<Document>>(
		first: Document,
		second: Document,
		field: IndexedKey<Document>
	): ComparisonResult {
		const firstValue = dotprop.get(first, field);
		const secondValue = dotprop.get(second, field);

		if (firstValue == null) {
			return ComparisonResult.SMALLER;
		}

		if (secondValue == null) {
			return ComparisonResult.GREATER;
		}

		if (typeof firstValue === 'string' && typeof secondValue === 'string') {
			return firstValue.localeCompare(secondValue);
		}

		if (typeof firstValue === 'number' && typeof secondValue === 'number') {
			return firstValue - secondValue;
		}

		throw createError(ErrorCodes.UNKNOWN, `Type ${typeof firstValue} can't be compared.`);
	}

	private static applyProjection<Document>(document: Document, projection: Projection<Document>): any {
		switch (projection.type) {
			case ProjectionType.EXCLUDE:
				for (const field of projection.fields) {
					dotprop.delete(document, field);
				}
				break;
			case ProjectionType.INCLUDE:
				// eslint-disable-next-line no-case-declarations
				const replacement = {};
				for (const field of projection.fields) {
					dotprop.set(replacement, field, dotprop.get(document, field));
				}

				// @ts-ignore, fucking son of a bitch, know your place, I kno what I'm doing
				document = replacement;
				break;
			default:
				throw createError(ErrorCodes.UNKNOWN, `Projection type '${projection.type} can't be handled.`);
		}
		return document;
	}

	private static snapshotIndexes<Document extends DocumentContract<Document>>(
		document: Document,
		indexes: ReadonlyArray<IndexedKey<Document>>
	): Record<IndexedKey<Document>, Optional<IndexValue>> {
		const snapshot = {} as Record<IndexedKey<Document>, Optional<IndexValue>>;

		for (const index of indexes) {
			snapshot[index] = dotprop.get(document, index);
		}

		return snapshot;
	}

	private static updateDocument<Document extends DocumentContract<Document>>(
		document: Document,
		update: ObjMap,
		storage: IndexedStore<Document>,
		indexes: ReadonlyArray<IndexedKey<Document>>
	): void {
		const indexesSnapshot = Collection.snapshotIndexes(document, indexes);
		const changes = mongoQuery(document, {}, update);
		Collection.updateIndexes(storage, document, indexesSnapshot, changes);
	}

	private static updateIndexes<Document extends DocumentContract<Document>>(
		storage: IndexedStore<Document>,
		document: Document,
		snapshot: Record<IndexedKey<Document>, Optional<IndexValue>>,
		changes: ReadonlyArray<Alteration<Document>>
	): void {
		function matcher(record: Document): boolean {
			return record[PRIMARY_KEY_INDEX] === document[PRIMARY_KEY_INDEX];
		}

		for (const change of changes) {
			if (Collection.RE_INDEXABLE_ALTERATIONS.has(change.op) && storage.containsIndex(change.key)) {
				storage.updateIndex(change.key, snapshot[change.key], change.value as IndexValue, matcher);
				continue;
			}
		}
	}

	private static validateDocuments<Document>(validator: Ajv.Ajv, documents: ReadonlyArray<Document>): void | never {
		for (const document of documents) {
			if (!validator.validate(Collection.constructor.name, document)) {
				AjvLocalizeEn(validator.errors);
				throw createError(ErrorCodes.INVALID_TYPE, validator.errorsText(validator.errors, { separator: '\n' }));
			}
		}
	}
}

export { Collection, DocumentIdentity, DocumentNotification, DocumentOperation, DocumentContract, Query, QueryConditions, Projection, ProjectionType };
