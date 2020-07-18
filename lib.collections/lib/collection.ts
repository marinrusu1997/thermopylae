import {
	Optional,
	Conditional,
	PersistableRecordKey,
	SortDirection,
	PersistablePrimitive,
	RequireOnlyOne,
	UnaryPredicate,
	SyncFunction,
	AsyncFunction,
	Nullable,
	Cloneable,
	Comparable,
	Identity,
	Same
} from '@thermopylae/core.declarations';
import { Observable, Subject } from 'rxjs';
// @ts-ignore
import mongoQuery from 'mongo-query';
// eslint-disable-next-line import/no-extraneous-dependencies
import { JSONSchema } from 'json-schema-typed';
// eslint-disable-next-line import/no-unresolved
import { QueryConditions, QueryProjection } from '@b4dnewz/mongodb-operators';
import Ajv from 'ajv';
// @ts-ignore
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import IndexedArray from 'indexable-array';

type PrimaryKey<Document> = Exclude<keyof Document, symbol>;
type SecondaryKey<Document> = Exclude<PersistableRecordKey, PrimaryKey<Document>>;
type IndexedKey<Document> = PrimaryKey<Document> | SecondaryKey<Document>;

type Cursor<Document> = Iterator<Document>;
type Projection<Document> = QueryProjection<Document>; /* Recordable<IndexedKey<Document>, boolean>; */
type SortFields<Document> = Record<IndexedKey<Document>, SortDirection>;

type PipelineFunction<Document, AlteredDocument extends Document> = (document: Document) => AlteredDocument;
type AggregationPipeline<Document> = ArrayLike<PipelineFunction<Document, Document>>; // FIXME what about stages ??

type Criteria<Specifications> = Optional<Partial<Specifications>>;

type FilterFunction<Document> = UnaryPredicate<Document>;
type MapFunction<Document, MappedDocument> = (document: Document) => MappedDocument;

type CursorOrCollection<CollectedResult, Document> = Conditional<CollectedResult, true, ReadonlyArray<Document>, Cursor<Document>>;

type Hints<Document> = ReadonlyArray<IndexedKey<Document>>;

type DocumentBase = Record<PersistableRecordKey, PersistablePrimitive | SyncFunction | AsyncFunction | { [Key in PersistableRecordKey]: DocumentBase }>;

type DocumentOperation = 'created' | 'updated' | 'replaced' | 'deleted' | 'dropped';

interface DocumentContract<DocType> extends DocumentBase, Cloneable<DocType>, Comparable<DocType>, Same<DocType>, Identity {
	readonly _id: PersistablePrimitive;
}

interface DocumentNotification<Document> {
	kind: DocumentOperation;
	original?: Document;
	alteration?: Document;
	batch?: ReadonlyArray<Document>;
}

interface Collation {
	locale: string;
	caseLevel: Optional<boolean>;
	caseFirst: Optional<string>;
	strength: Optional<number>;
	numericOrdering: Optional<boolean>;
	alternate: Optional<string>;
	maxVariable: Optional<string>;
	backwards: Optional<boolean>;
}

interface FindCriteria<Document> {
	projection: Projection<Document>;
	hint: Hints<Document>;
}

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

interface DeleteCriteria<Document> {
	multiple: boolean;
	projection: Projection<Document>;
	sort: SortFields<Document>;
	collation: Collation;
}

interface ReplaceCriteria<Document> {
	projection: Projection<Document>;
	sort: SortFields<Document>;
	upsert: boolean;
	multiple: boolean;
	returnNewDocument: boolean;
	collation: Collation;
	hint: ReadonlyArray<IndexedKey<Document>>;
	// FIXME array filters
}

interface UpdateCriteria<Document> {
	projection: Projection<Document>;
	sort: SortFields<Document>;
	upsert: boolean;
	multi: boolean;
	multiple: boolean;
	returnNewDocument: boolean;
	collation: Collation;
	hint: ReadonlyArray<IndexedKey<Document>>;
	// FIXME array filters
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
	primaryKey: PrimaryKey<Document>;
	initial: Optional<Iterable<Document> | ArrayLike<Document>>;
	indexKeys: Optional<ReadonlyArray<PersistableRecordKey>>;
	schema: Optional<JSONSchema>;
	clones: Optional<boolean>;
}

class Collection<Document extends DocumentContract<Document>> implements Iterable<Document>, Cloneable<Collection<Document>> {
	private readonly collName!: string;

	private readonly storage: IndexedArray<Document, PrimaryKey<Document>, SecondaryKey<Document>>;

	private readonly emitter: Subject<DocumentNotification<Document>>;

	private readonly clones: boolean;

	private readonly validator: Nullable<Ajv.Ajv>;

	public constructor(options: CollectionOptions<Document>) {
		this.collName = Collection.assertCollectionName(options.name);
		this.storage = IndexedArray.from(options.initial || [], options.primaryKey, ...(options.indexKeys || []));
		this.emitter = new Subject<DocumentNotification<Document>>();
		this.clones = options.clones || false;

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
		return Array.from(this.storage.indexedKeys);
	}

	public insert(...documents: ReadonlyArray<Document>): void {
		if (this.validator) {
			for (const document of documents) {
				if (!this.validator.validate(this.name, document)) {
					AjvLocalizeEn(this.validator.errors);
					throw new Error(this.validator.errorsText(this.validator.errors, { separator: '\n' }));
				}
			}
		}

		this.storage.push(...documents);

		documents = this.clones ? documents.map((document) => document.clone()) : documents;

		this.emitter.next({
			kind: 'created',
			batch: documents
		});
	}

	public find<CollectedResult = false>(
		query: QueryConditions<Document>,
		criteria?: Partial<FindCriteria<Document>>
	): CursorOrCollection<CollectedResult, Document> {
		criteria = criteria || {};
		criteria.hint = criteria.hint || [];
		criteria.projection = criteria.projection || {};
	}

	public findOne(query: Query, projection: Optional<Projection<Document>>): Optional<Document>;

	public findOneAndModify(document: RequireOnlyOne<FindAndModifyCriteria<Document>, 'remove' | 'update'>): Optional<Document>;

	public replace(query: Query, replacement: Document, criteria: Criteria<ReplaceCriteria<Document>>): Optional<Document>;

	public update(query: Query, update: Update, criteria: Criteria<UpdateCriteria<Document>>): Optional<Document>;

	public delete(query: Query, criteria: Criteria<DeleteCriteria<Document>>): Optional<Document>;

	public drop(): void;

	public count(query: Query, options: Optional<Partial<CountOptions>>): number;

	public mapReduce<MappedDocument, CollectedResult = false>(
		mapper: MapFunction<Document, MappedDocument>,
		filter: FilterFunction<Document>,
		criteria: Criteria<MapReduceCriteria>
	): CursorOrCollection<CollectedResult, Document>;

	public distinct(field: PersistableRecordKey | Array<PersistableRecordKey>, query: Optional<Query>, options: Optional<DistinctOptions>): Array<Document>;

	public watch(): Observable<DocumentNotification<Document>> {
		return this.emitter.asObservable();
	}

	public clone(): Collection<Document>;

	public createIndexes(...indexes: Array<IndexedKey<Document>>): this {
		// @ts-ignore
		this.storage.addIndex(...indexes);
		return this;
	}

	public ensureIndex(index: IndexedKey<Document>): this {
		if (!this.storage.indexedKeys.has(index)) {
			return this.createIndexes(index);
		}
		return this;
	}

	public dropIndexes(): this {
		// @ts-ignore
		this.storage.clearIndex();
		return this;
	}

	public disableIndex(): this {
		this.storage.disableIndex();
		return this;
	}

	public enableIndex(): this {
		this.storage.enableIndex();
		return this;
	}

	[Symbol.iterator](): Cursor<Document> {
		return undefined;
	}

	private retrieveHintedDocuments(hints: Hints<Document>): ReadonlyArray<Document> {
		for (const indexedKey of hints) {
			this.storage.get;
		}
	}

	private static assertCollectionName(name: string): never | typeof name {
		if (name.length === 0) {
			throw new Error(`Collection name can't be empty.`);
		}
		return name;
	}
}

export { Collection };
