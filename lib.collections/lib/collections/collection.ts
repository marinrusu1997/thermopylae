import {
	AsyncFunction,
	Cloneable,
	Comparable,
	ComparisonResult,
	Conditional,
	Identity,
	Nullable,
	ObjMap,
	Optional,
	PersistablePrimitive,
	PersistableRecordKey,
	Same,
	SortDirection,
	SyncFunction,
	UnaryPredicate,
	Undefinable
} from '@thermopylae/core.declarations';
import { Observable, Subject } from 'rxjs';
import sorter from 'thenby';
// @ts-ignore
import mongoQuery from 'mongo-query';
// eslint-disable-next-line import/no-extraneous-dependencies
import { JSONSchema } from 'json-schema-typed';
// eslint-disable-next-line import/no-unresolved
import { QueryConditions } from '@b4dnewz/mongodb-operators';
import Ajv from 'ajv';
// @ts-ignore
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import objectPath from 'object-path';
import { IndexedStore, IndexName, PRIMARY_KEY_INDEX } from './indexed-store';
import { createError, ErrorCodes } from '../error';

type KeyOf<Document> = Exclude<keyof Document, symbol>;
type IndexedKey<Document> = KeyOf<Document> | Exclude<PropertyKey, symbol>;
type IndexValue = string | number;

type Cursor<Document> = Iterator<Document>;
type SortFields<Document> = Record<IndexedKey<Document>, SortDirection>;

type PipelineFunction<Document, AlteredDocument extends Document> = (document: Document) => AlteredDocument;
type AggregationPipeline<Document> = ArrayLike<PipelineFunction<Document, Document>>; // FIXME what about stages ??

type Criteria<Specifications> = Optional<Partial<Specifications>>;

type FilterFunction<Document> = UnaryPredicate<Document>;
type MapFunction<Document, MappedDocument> = (document: Document) => MappedDocument;

type CursorOrCollection<CollectedResult, Document> = Conditional<CollectedResult, true, ReadonlyArray<Document>, Cursor<Document>>;

type DocumentBase = Record<PersistableRecordKey, PersistablePrimitive | SyncFunction | AsyncFunction | { [Key in PersistableRecordKey]: DocumentBase }>;

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
	DELETED = 'deleted',
	DROPPED = 'dropped'
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

interface DocumentContract<DocType> extends DocumentBase, Cloneable<DocType>, Comparable<DocType>, Same<DocType>, Identity {
	readonly id: IndexValue;
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
	projection: Projection<Document>;
	hint: Hint<Document>;
}

interface AlterationCriteria<Document> extends FindCriteria<Document> {
	sort: SortFields<Document>;
	multiple: boolean;
}

interface ReplaceCriteria<Document> extends AlterationCriteria<Document> {
	upsert: boolean;
}

interface UpdateCriteria<Document> extends AlterationCriteria<Document> {
	returnUpdates: boolean;
}

type DeleteCriteria<Document> = AlterationCriteria<Document>;

interface FindAndModifyCriteria<Document> {
	query: QueryConditions<Document>;
	remove: boolean;
	update: Document | AggregationPipeline<Document>;
	sort: Optional<SortFields<Document>>;
	new: Optional<boolean>;
	fields: Optional<Projection<Document>>;
	upsert: Optional<boolean>;
	bypassDocumentValidation: Optional<boolean>;
	collation: Optional<Collation>;
	// FIXME handle updates on array fields
}

interface CountOptions {
	limit: number;
	skip: number;
	hint: string;
	collation: Collation;
}

interface DistinctOptions {
	collation: Optional<Collation>;
}

interface MapReduceCriteria {
	limit: number;
	array: boolean;
}

interface CollectionOptions<Document> {
	name: string;
	indexKeys?: ReadonlyArray<IndexedKey<Document>>;
	schema?: JSONSchema;
	documentsIdentity?: DocumentIdentity;
}

class Collection<Document extends DocumentContract<Document>> implements Iterable<Document>, Cloneable<Collection<Document>> {
	private readonly collName!: string;

	private readonly storage: IndexedStore<Document>;

	private readonly notifier: Subject<DocumentNotification<Document>>;

	private readonly identity: DocumentIdentity;

	private readonly validator: Nullable<Ajv.Ajv>;

	public constructor(options: CollectionOptions<Document>) {
		this.collName = Collection.assertCollectionName(options.name);
		this.storage = new IndexedStore<Document>({ indexes: options.indexKeys });
		this.notifier = new Subject<DocumentNotification<Document>>();
		this.identity = options.documentsIdentity || DocumentIdentity.ORIGINAL;

		if (options.schema) {
			this.validator = new Ajv({ allErrors: true });
			this.validator.addSchema(options.schema, this.name);
		} else {
			this.validator = null;
		}
	}

	public get name(): string {
		return this.collName;
	}

	public get indexes(): ReadonlyArray<IndexedKey<Document>> {
		return this.storage.indexes;
	}

	public insert(...documents: ReadonlyArray<Document>): void {
		if (this.validator) {
			Collection.validateDocuments(this.validator, documents);
		}

		this.storage.save(...documents);

		if (this.identity === DocumentIdentity.CLONE) {
			documents = Collection.clone(documents);
		}

		this.notifier.next({
			action: DocumentOperation.CREATED,
			documents
		});
	}

	public find(query: QueryConditions<Document>, criteria?: Partial<FindCriteria<Document>>): ReadonlyArray<Document> {
		const matches = this.retrieveMatches(query, criteria);

		if (criteria && criteria.projection) {
			return Collection.project(matches, criteria.projection);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			return Collection.clone(matches);
		}

		return matches;
	}

	public findOne(query: QueryConditions<Document>, criteria?: Partial<FindCriteria<Document>>): Optional<Document> {
		const match = this.retrieveFirstMatch(query, criteria);

		if (match == null) {
			return match;
		}

		if (criteria && criteria.projection) {
			return Collection.applyProjection(match.clone(), criteria.projection);
		}

		if (this.identity === DocumentIdentity.CLONE) {
			return match.clone();
		}

		return match;
	}

	/* public findOneAndModify(document: RequireOnlyOne<FindAndModifyCriteria<Document>, 'remove' | 'update'>): Optional<Document>; */

	public replace(query: QueryConditions<Document>, replacement: Document, criteria?: Partial<ReplaceCriteria<Document>>): ReadonlyArray<Document> {
		let matches = this.findAndDelete(query, criteria);

		this.storage.save(replacement);
		this.notifier.next({
			action: DocumentOperation.CREATED,
			documents: [replacement]
		});

		if (criteria && criteria.projection) {
			matches = Collection.project(matches, criteria.projection);
		}

		return matches;
	}

	public update(query: QueryConditions<Document>, update: ObjMap, criteria?: Partial<UpdateCriteria<Document>>): ReadonlyArray<Document> {
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

	public delete(query: QueryConditions<Document>, criteria?: Partial<DeleteCriteria<Document>>): ReadonlyArray<Document> {
		let matches = this.findAndDelete(query, criteria);

		if (criteria && criteria.projection) {
			matches = Collection.project(matches, criteria.projection);
		}

		return matches;
	}

	public drop(): void;

	public count(query: Query, options: Optional<Partial<CountOptions>>): number;

	public mapReduce<MappedDocument, CollectedResult = false>(
		mapper: MapFunction<Document, MappedDocument>,
		filter: FilterFunction<Document>,
		criteria: Criteria<MapReduceCriteria>
	): CursorOrCollection<CollectedResult, Document>;

	public distinct(field: PersistableRecordKey | Array<PersistableRecordKey>, query: Optional<Query>, options: Optional<DistinctOptions>): Array<Document>;

	public watch(): Observable<DocumentNotification<Document>> {
		return this.notifier.asObservable();
	}

	public clone(): Collection<Document>;

	public createIndexes(...indexes: Array<IndexedKey<Document>>): this {
		this.storage.createIndexes(indexes);
		return this;
	}

	public ensureIndex(index: IndexedKey<Document>): this {
		if (!this.storage.containsIndex(index)) {
			return this.createIndexes(index);
		}
		return this;
	}

	public dropIndexes(): this {
		this.storage.dropIndexes();
		return this;
	}

	[Symbol.iterator](): Cursor<Document> {
		return undefined;
	}

	private retrieveFirstMatch(query: QueryConditions<Document>, criteria?: Partial<FindCriteria<Document>>): Optional<Document> {
		let onIndex: Undefinable<IndexName<Document>>;
		let withValue: Undefinable<IndexValue>;
		if (criteria && criteria.hint) {
			onIndex = criteria.hint.index;
			withValue = criteria.hint.value;
		}

		const filter = mongoQuery.filter(query);
		return this.storage.find(filter.test, onIndex, withValue);
	}

	private retrieveMatches(query: QueryConditions<Document>, criteria?: Partial<FindCriteria<Document>>): Array<Document> {
		let onIndex: Undefinable<IndexName<Document>>;
		let withValue: Undefinable<IndexValue>;
		if (criteria && criteria.hint) {
			onIndex = criteria.hint.index;
			withValue = criteria.hint.value;
		}

		const filter = mongoQuery.filter(query);
		return this.storage.filter(filter.test, onIndex, withValue);
	}

	private retrieveAlterationCandidates(
		query: QueryConditions<Document>,
		criteria: Partial<AlterationCriteria<Document>>,
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

	private findAndDelete(query: QueryConditions<Document>, criteria?: Partial<AlterationCriteria<Document>>): ReadonlyArray<Document> {
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
			this.storage.remove(PRIMARY_KEY_INDEX, matches[i].id);
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
		const firstValue = objectPath.get(first, field);
		const secondValue = objectPath.get(second, field);

		if (firstValue == null) {
			return ComparisonResult.SMALLER;
		}

		if (secondValue == null) {
			return ComparisonResult.GREATER;
		}

		switch (typeof firstValue) {
			case 'string':
				return firstValue.localeCompare(secondValue);
			case 'number':
				return firstValue - ((secondValue as unknown) as number);
			default:
				throw createError(ErrorCodes.UNKNOWN, `Type ${typeof firstValue} can't be compared.`);
		}
	}

	private static applyProjection<Document>(document: Document, projection: Projection<Document>): any {
		switch (projection.type) {
			case ProjectionType.EXCLUDE:
				for (const field of projection.fields) {
					objectPath.del((document as unknown) as ObjMap, field);
				}
				break;
			case ProjectionType.INCLUDE:
				// eslint-disable-next-line no-case-declarations
				const replacement = {};
				for (const field of projection.fields) {
					objectPath.set(replacement, field, objectPath.get((document as unknown) as ObjMap, field));
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
	): Record<IndexedKey<Document>, IndexValue> {
		const snapshot = {} as Record<IndexedKey<Document>, IndexValue>;

		for (const index of indexes) {
			snapshot[index] = objectPath.get(document, index);
		}

		return snapshot;
	}

	private static updateIndexes<Document extends DocumentContract<Document>>(
		storage: IndexedStore<Document>,
		document: Document,
		snapshot: Record<IndexedKey<Document>, IndexValue>,
		changes: ReadonlyArray<Alteration<Document>>
	): void {
		const reindex = new Set([AlterationType.SET, AlterationType.INC, AlterationType.RENAME, AlterationType.UNSET]);

		function matcher(record: Document): boolean {
			return record.id === document.id;
		}

		for (const change of changes) {
			if (reindex.has(change.op)) {
				storage.updateIndex(change.key, matcher, snapshot[change.key], change.value! as IndexValue);
				continue;
			}
		}
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

	private static assertCollectionName(name: string): never | typeof name {
		if (name.length === 0) {
			throw new Error(`Collection name can't be empty.`);
		}
		return name;
	}

	private static validateDocuments<Document>(validator: Ajv.Ajv, documents: ReadonlyArray<Document>): void | never {
		for (const document of documents) {
			if (!validator.validate(this.name, document)) {
				AjvLocalizeEn(validator.errors);
				throw new Error(validator.errorsText(validator.errors, { separator: '\n' }));
			}
		}
	}

	private static formatSortDirection(direction: SortDirection): string {
		switch (direction) {
			case SortDirection.ASCENDING:
				return 'ASCENDING';
			case SortDirection.DESCENDING:
				return 'DESCENDING';
			default:
				throw createError(ErrorCodes.UNKNOWN, `Couldn't format sort direction ${direction}.`);
		}
	}
}

export { Collection };
