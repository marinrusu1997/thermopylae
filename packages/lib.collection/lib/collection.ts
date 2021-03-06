import { Mapper, Nullable, ObjMap, Optional } from '@thermopylae/core.declarations';
import { IndexedStore } from '@thermopylae/lib.indexed-store';
import rxsubject, { Subject, Subscribable } from 'rx-subject';
import { JSONSchema } from 'json-schema-typed';
import Ajv from 'ajv';
// eslint-disable-next-line import/extensions
import AjvLocalizeEn from 'ajv-i18n/localize/en';
import { createException, ErrorCodes } from './error';
import { DeleteOptions, DocumentContract, FindOptions, IndexedKey, IndexOptions, Query, ReplaceOptions, UpdateOptions, PK_INDEX_NAME } from './typings';
import { Processor } from './processor';
import { Retriever } from './retriever';

// @ts-ignore There is a problem with ESM version of rx-subject,
// as it actually exports an object with property `default` that contains createSubject function
const createSubject = rxsubject.default;

type Cursor<Document> = Iterator<Document>;

/**
 * Describes which version of document needs to be stored by {@link Collection}.
 */
const enum DocumentOriginality {
	/**
	 * Store a clone of the document.
	 */
	CLONE,
	/**
	 * Store it's original.
	 */
	ORIGINAL
}

const enum DocumentOperation {
	CREATED = 'created',
	UPDATED = 'updated',
	DELETED = 'deleted',
	CLEARED = 'cleared'
}

/**
 * Notification sent to observers when {@link Collection} suffers modifications.
 */
interface DocumentNotification<Document> {
	/**
	 * Operation that took place.
	 */
	operation: DocumentOperation;
	/**
	 * Affected documents.
	 */
	documents: Array<Document>;
}

/**
 * {@link Collection} construction options.
 */
interface CollectionOptions<Document> {
	/**
	 * Name of document keys, in dot notation, that need to be indexed.
	 *
	 * @default null	Only primary key property will be indexed.
	 */
	indexKeys: Array<IndexedKey<Document>>;
	/**
	 * [JSON Schema]{@link https://json-schema.org/} used for document validation.
	 *
	 * @default null	Documents won't be validated.
	 */
	schema: JSONSchema;
	/**
	 * Which version of document to store: clone or original.
	 *
	 * @default {@link DocumentOriginality.ORIGINAL}
	 */
	documentsOriginality: DocumentOriginality;
	/**
	 * Whether search and update mongoose queries need to be validated before respective operations.
	 *
	 * @default true
	 */
	validateQueries: boolean;
}

/**
 * Collection of documents which are kept indexed.
 *
 * @template Document	Type of the document. <br/>
 * 						Document must implement {@link DocumentContract}.
 */
class Collection<Document extends DocumentContract<Document>> implements Iterable<Document> {
	private readonly storage: IndexedStore<Document>;

	private readonly notifier: Subject<DocumentNotification<Document>>;

	private readonly originality: DocumentOriginality;

	private readonly validator: Nullable<Ajv>;

	private readonly retriever: Retriever<Document>;

	private readonly processor: Processor<Document>;

	public constructor(options?: Partial<CollectionOptions<Document>>) {
		options = options || {};

		this.storage = new IndexedStore<Document>({ indexes: options.indexKeys });
		this.notifier = createSubject<DocumentNotification<Document>>();
		this.originality = options.documentsOriginality != null ? options.documentsOriginality : DocumentOriginality.ORIGINAL;

		this.retriever = new Retriever<Document>(this.storage, options.validateQueries);
		this.processor = new Processor<Document>(this.storage, options.validateQueries);

		if (options.schema) {
			this.validator = new Ajv({ allErrors: true });
			this.validator.addSchema(options.schema, Collection.constructor.name);
		} else {
			this.validator = null;
		}
	}

	/**
	 * Returns the indexed properties.
	 */
	public get indexes(): Array<IndexedKey<Document>> {
		return this.storage.indexes;
	}

	/**
	 * Inserts `documents` into {@link Collection}. <br/>
	 * Documents are validated according to JSON Schema (if given). <br/>
	 * When documents originality is {@link DocumentOriginality.CLONE}, they will be cloned, prior indexing. <br/>
	 * After indexing, {@link DocumentNotification} which contains inserted documents is emitted. <br/>
	 */
	public insert(documents: Document | Array<Document>): void {
		if (!Array.isArray(documents)) {
			documents = [documents];
		}

		if (this.validator) {
			Collection.validateDocuments(this.validator, documents);
		}

		if (this.originality === DocumentOriginality.CLONE) {
			documents = Processor.clone(documents);
		}

		this.storage.insert(documents);

		this.notifier.sink.next({
			operation: DocumentOperation.CREATED,
			documents
		});
	}

	/**
	 * Selects documents in a collection and returns them. <br>
	 * Found documents are post-processed according to `options`.
	 *
	 * @example <br>
	 *
	 * Find all documents
	 * ------------------
	 * <pre><code>collection.find()</code></pre>
	 *
	 * Find document by id
	 * -------------------
	 * <pre><code>collection.find('unique-id')</code></pre>
	 *
	 * Find documents by indexed property
	 * -------------------
	 * <pre><code>// returns all documents having `birthYear` equals to 2000
	 * collection.find(null, {
	 *    index: {
	 *        name: 'birthYear',
	 *        value: 2000
	 *    }
	 * });
	 * </code></pre>
	 *
	 * Find documents and post-process them
	 * -------------------
	 * <pre><code>// returns all documents having `birthYear` greater than 2000, sorted by `firstName`
	 * const query = { birthYear: { $gt: 2000 } };
	 * const options = { sort: { firstName: {@link SortDirection.ASCENDING} } };
	 * const matches = collection.find(query, options);
	 * </code></pre>
	 */
	public find(query?: Nullable<Query<Document>>, options?: Partial<FindOptions<Document>>): Array<Document> {
		return this.retriever.retrieve(query, options);
	}

	/**
	 * Replace documents that match the `query` with the `replacement`. <br>
	 * Emits 2 {@link DocumentNotification} when matches were replaced:
	 * 1. {@link DocumentOperation.DELETED} with the matches that were removed.
	 * 2. {@link DocumentOperation.CREATED} with the replacement.
	 *
	 * @example <br>
	 *
	 * Replace document by id
	 * -------------------
	 * <pre><code>collection.replace('unique-id', replacement);</code></pre>
	 *
	 * Replace multiple documents with a single one
	 * -------------------
	 * <pre><code> // replace all documents having `birthYear` greater than 2000
	 * const query = { birthYear: { $gt: 2000 } };
	 * collection.replace(query, replacement);
	 * </code></pre>
	 *
	 * Insert replacement if no matches found
	 * -------------------
	 * <pre><code> // no persons with name 'John' are present in the collection
	 * const query = { firstName: 'John' };
	 * collection.replace(query, replacement, { upsert: true });
	 * </code></pre>
	 */
	public replace(query: Query<Document>, replacement: Document, options?: Partial<ReplaceOptions<Document>>): Array<Document> {
		const matches = this.findAndDelete(query, options);

		if (matches.length || (matches.length === 0 && options && options.upsert)) {
			this.insert(replacement);
		}

		return matches;
	}

	/**
	 * Modifies an existing document or documents.
	 * The method can modify specific fields of an existing document or documents. <br>
	 * When one of the indexed properties is updated, documents will be re-indexed with
	 * the new values of them. <br>
	 * Emits {@link DocumentNotification} with operation {@link DocumentOperation.UPDATED} which
	 * contains the updated documents.
	 *
	 * @example <br>
	 *
	 * Update document by id
	 * -------------------
	 * <pre><code>const update = {
	 *   $set: {
	 *       birthYear: 2000
	 *   }
	 * };
	 * // returns old document
	 * collection.update('unique-id', update);
	 * </code></pre>
	 *
	 * Update multiple documents
	 * -------------------
	 * <pre><code>const update = {
	 *   $inc: {
	 *       salary: 100
	 *   }
	 * };
	 * const query = {
	 *   commits: {
	 *       $gt: 25
	 *   }
	 * };
	 * const options = {
	 *   returnUpdates: true
	 * };
	 * // returns updated documents
	 * collection.update(query, update, options);
	 * </code></pre>
	 *
	 * Reindex renamed property
	 * -------------------
	 * <pre><code>const update = {
	 *    $rename: {
	 *        oldIndexName: newName
	 *    }
	 * };
	 * // will de-index renamed index property
	 * collection.update('unique-id', update);
	 *
	 * const bringBackIndex = {
	 *   $unset: {
	 *       newName: ''
	 *   },
	 *   $set: {
	 *       oldIndexName: 'new-value'
	 *   }
	 * };
	 * collection.update('unique-id', bringBackIndex);
	 * </code></pre>
	 */
	public update(query: Query<Document>, update: ObjMap, options?: Partial<UpdateOptions<Document>>): Array<Document> {
		const matches = this.find(query, options);

		let original: Optional<Array<Document>>;
		if (!(options && options.returnUpdated)) {
			original = Processor.clone(matches);
		}

		this.processor.update(matches, update);

		this.notifier.sink.next({
			operation: DocumentOperation.UPDATED,
			documents: matches
		});

		return original || matches;
	}

	/**
	 * Removes documents that match the `query`.
	 * Emits {@link DocumentNotification} with operation {@link DocumentOperation.DELETED} which
	 * contains the deleted documents.
	 *
	 * @example <br>
	 *
	 * Delete document by id
	 * -------------------
	 * <pre><code>collection.delete('unique-id');</code></pre>
	 *
	 * Delete multiple documents
	 * -------------------
	 * <pre><code>// removes all documents having `fullName` equal to 'John'
	 * const query = {
	 *    fullName: 'John'
	 * };
	 * collection.delete(query);
	 * </code></pre>
	 *
	 * @returns     Deleted documents.
	 */
	public delete(query: Query<Document>, options?: Partial<DeleteOptions<Document>>): Array<Document> {
		return this.findAndDelete(query, options);
	}

	/**
	 * Get the number of documents in the {@link Collection}.
	 *
	 * @returns		Total number of documents.
	 */
	public get count(): number {
		return this.storage.size;
	}

	/**
	 * Clear the {@link Collection} by removing all documents. <br>
	 * Emits {@link DocumentNotification} with operation {@link DocumentOperation.CLEARED} and documents `null`. <br>
	 * After clearing you can add new documents. <br>
	 */
	public clear(): void {
		this.storage.clear();
		this.notifier.sink.next({
			operation: DocumentOperation.CLEARED,
			// @ts-ignore They will be assigned later (maybe, I don't know for sure)
			documents: null
		});
	}

	/**
	 * Clear the {@link Collection} by removing all documents. <br>
	 * Emits {@link DocumentNotification} with operation {@link DocumentOperation.CLEARED} and documents `null`. <br>
	 * After dropping, collection becomes non-reactive, and no more {@link DocumentNotification} will be emitted.
	 * Therefore it's recommended to not reuse {@link Collection} object after this operation.
	 */
	public drop(): void {
		this.clear();
		if (this.notifier.sink.complete != null) {
			this.notifier.sink.complete();
		}
	}

	/**
	 * Maps {@link Collection} documents. <br>
	 * If you need to map only a subset of documents, you can specify an index that needs to be mapped by using `options` argument.
	 *
	 * @param mapper	Mapping function.
	 * @param options	Options which control set of documents that needs to be mapped.
	 *
	 * @returns		Mapped documents.
	 */
	public map<MappedDocument>(mapper: Mapper<Document, MappedDocument>, options?: Partial<IndexOptions<Document>>): Array<MappedDocument> {
		if (options == null || options.index == null) {
			return this.storage.map(mapper);
		}
		return this.storage.map(mapper, options.index.name, options.index.value);
	}

	/**
	 * Watch the collection and receive {@link DocumentNotification} when something changes.
	 *
	 * @returns	Subscribable for subscribing to notifications.
	 */
	public watch(): Subscribable<DocumentNotification<Document>> {
		return this.notifier.source$;
	}

	/**
	 * Create indexes for document keys.
	 *
	 * @param keys	Keys to be indexed.
	 */
	public createIndexes(...keys: Array<IndexedKey<Document>>): void {
		this.storage.createIndexes(keys);
	}

	/**
	 * Create index for property only if is not indexed already.
	 *
	 * @param key	Key to be indexed.
	 *
	 * @returns		Whether index was created or not.
	 * 				Returning `false` means index was present already.
	 */
	public createIndexIfMissing(key: IndexedKey<Document>): boolean {
		if (!this.storage.containsIndex(key)) {
			this.createIndexes(key);
			return true;
		}
		return false;
	}

	/**
	 * Remove indexes associated with `keys`.
	 *
	 * @param keys	Name of properties, associated indexes of which needs to be removed.
	 */
	public dropIndexes(...keys: Array<IndexedKey<Document>>): void {
		if (!keys.length) {
			this.storage.dropIndexes();
			return;
		}

		for (const index of keys) {
			this.storage.dropIndex(index);
		}
	}

	/**
	 * Iterate over {@link Collection} documents.
	 */
	[Symbol.iterator](): Cursor<Document> {
		return this.storage[Symbol.iterator]();
	}

	private findAndDelete(query: Query<Document>, options?: Partial<FindOptions<Document>>): Array<Document> {
		const matches = this.find(query, options);

		if (matches.length) {
			for (let i = 0; i < matches.length; i++) {
				this.storage.remove(PK_INDEX_NAME, matches[i][PK_INDEX_NAME]);
			}

			this.notifier.sink.next({
				operation: DocumentOperation.DELETED,
				documents: matches
			});
		}

		return matches;
	}

	private static validateDocuments<DocumentType>(validator: Ajv, documents: ReadonlyArray<DocumentType>): void | never {
		for (const document of documents) {
			if (!validator.validate(Collection.constructor.name, document)) {
				AjvLocalizeEn(validator.errors as null); // dumb ajv typings
				throw createException(ErrorCodes.DOCUMENT_NOT_VALID_AGAINST_JSON_SCHEMA, validator.errorsText(validator.errors, { separator: '\n' }), document);
			}
		}
	}
}

export { Collection, CollectionOptions, DocumentOriginality, DocumentOperation, DocumentNotification };
