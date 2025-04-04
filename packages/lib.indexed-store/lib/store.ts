import type { Mapper, ObjMap, Optional, UnaryPredicate } from '@thermopylae/core.declarations';
import { getProperty, setProperty } from 'dot-prop';
import { ErrorCodes, createException } from './error.js';
import type { Index, IndexName, IndexRepo, IndexValue, Recordable } from './typings.js';
import { PK_INDEX_NAME } from './typings.js';

/** Options used at {@link IndexedStore} construction. */
interface IndexedStoreOptions<RecordType> {
	/** Name of the properties that need to be indexed. */
	indexes?: ReadonlyArray<IndexName<RecordType>>;
}

/**
 * {@link IndexedStore} represents a storage of records that are indexed over multiple properties.
 * <br> Records ar stored in a multilevel map, with the following structure: <br><pre><code>
 * PrimaryIndexName --> IndexValue --> [document] --> IndexValue --> [document] SecondaryIndexName
 * --> IndexValue --> [document, document] </code></pre>
 *
 * Indexed properties are allowed to be nullable (i.e. have `null` or `undefined` as their values).
 * <br> This is a low-level class and exposes raw primitives. It needs to be used by higher level
 * abstractions.
 *
 * @template IndexedRecord Type of the indexed record.
 */
class IndexedStore<IndexedRecord extends Recordable> implements Iterable<IndexedRecord> {
	private readonly indexRepo: IndexRepo<IndexedRecord>;

	/**
	 * {@link IndexedStore} constructor.
	 *
	 * @param options Construction options. <br> When {@link IndexedStoreOptions.indexes} is given,
	 *   will create them.
	 */
	public constructor(options?: IndexedStoreOptions<IndexedRecord>) {
		this.indexRepo = new Map<IndexName<IndexedRecord>, Index<IndexedRecord>>();

		const indexes = ((options && options.indexes) || []).concat(PK_INDEX_NAME);
		IndexedStore.defineIndexes(this.indexRepo, indexes);
	}

	/**
	 * Inserts records into storage. <br> After insertion is completed, will index records by
	 * properties that are indexable.
	 *
	 * @param records List of documents to be inserted.
	 */
	public insert(records: Array<IndexedRecord>): void {
		const { indexes } = this;

		for (const record of records) {
			if (this.indexRepo.get(PK_INDEX_NAME)!.has(record.id)) {
				throw createException(ErrorCodes.RECORD_EXISTS, `Record with primary key '${record.id}' has been added already.`);
			}

			IndexedStore.assertRecordIndexes(record, indexes);

			for (const [indexName, index] of this.indexRepo) {
				IndexedStore.indexRecordBy(record, getProperty(record, indexName), index);
			}
		}
	}

	/**
	 * Read documents under `indexName` having it's value equal to `indexValue`. <br> Reference to
	 * internal index structure is returned, and therefore the caller should not alter it.
	 *
	 * @param   indexName  Name of the index.
	 * @param   indexValue Value of that index.
	 *
	 * @returns            List of documents having `indexName` equal to `indexValue`.
	 */
	public read(indexName: IndexName<IndexedRecord>, indexValue: IndexValue): Array<IndexedRecord> {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
		return index.get(IndexedStore.assertNonNullableIndexValue(indexName, indexValue)) || [];
	}

	/**
	 * Read all documents stored in the `indexName`. <br> Reference to internal index structure is
	 * returned, and therefore the caller should not alter it.
	 *
	 * @param   indexName Name of the index.
	 *
	 * @returns           The internal index for `indexName`.
	 */
	public readIndex(indexName: IndexName<IndexedRecord>): Index<IndexedRecord> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
	}

	/**
	 * Check whether `indexName` contains records indexed with `indexValue`.
	 *
	 * @param indexName  Name of the index.
	 * @param indexValue Value of that index.
	 */
	public contains(indexName: IndexName<IndexedRecord>, indexValue: IndexValue): boolean {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
		return index.has(IndexedStore.assertNonNullableIndexValue(indexName, indexValue));
	}

	/**
	 * Check whether index with `indexName` exists.
	 *
	 * @param indexName Name of the index.
	 */
	public containsIndex(indexName: IndexName<IndexedRecord>): boolean {
		return this.indexRepo.has(indexName);
	}

	/**
	 * Remove from storage record that match search criteria. <br> Search criteria is expressed as
	 * name of the index, it's value, and an optional predicate for filtering records from that
	 * index. <br> Notice that only the first record that matched the predicate will be removed.
	 * <br>
	 *
	 * @example
	 * 	<br>
	 *
	 * 	Delete record by primary index
	 * 	-------------------
	 * 	<pre><code>storage.remove('id', 'value-of-id');</code></pre>
	 *
	 * 	Delete record by secondary index
	 * 	-------------------
	 * 	<pre><code>// removes record having `fullName` equal to 'John', and `age` equal to 18
	 * 	storage.remove('fullName', 'John', record => record.age === 18);
	 * 	</code></pre>
	 *
	 * @param   indexName  Name of the index.
	 * @param   indexValue Value of that index.
	 * @param   predicate  Predicate used for record filtering. <br> When `indexName` is the primary
	 *   one, this parameter is optional.
	 *
	 * @returns            Removed document, if found.
	 */
	public remove(indexName: IndexName<IndexedRecord>, indexValue: IndexValue, predicate?: UnaryPredicate<IndexedRecord>): Optional<IndexedRecord> {
		indexValue = IndexedStore.assertNonNullableIndexValue(indexName, indexValue);

		if (indexName !== PK_INDEX_NAME) {
			if (predicate == null) {
				throw createException(
					ErrorCodes.PREDICATE_REQUIRED,
					`Predicate is required when removing from index '${indexName}', which is a non primary one.`
				);
			}
		} else {
			predicate = (record: IndexedRecord) => record[PK_INDEX_NAME] === indexValue;
		}

		const records = this.getIndexRecords(indexName, indexValue);
		if (records == null) {
			return undefined;
		}

		const record = IndexedStore.removeRecord(records, predicate);

		if (record == null) {
			return undefined;
		}

		for (const [registryIndexName, registryIndex] of this.indexRepo) {
			IndexedStore.removeIndexedRecordBy(record, getProperty(record, registryIndexName), registryIndex);
		}

		this.indexRepo.get(PK_INDEX_NAME)!.delete(record[PK_INDEX_NAME]);

		return record;
	}

	/**
	 * Reindex document after it's `indexName` property has been changed. <br> This method will also
	 * set the new value of `indexName` to record. <br> Caller needs to call this method everytime
	 * value for one of the indexed properties changes. <br> Notice that primary key should remain
	 * immutable, it's change is forbidden. <br/>
	 *
	 * @example
	 * 	<br>
	 *
	 * 	**Index record that wasn't indexed before**
	 * 	------------------------------------------------
	 * 	<pre><code>// insert a record that wasn't indexed by 'birthYear', because it was null
	 * 	const record = { id: 1, birthYear: null };
	 * 	storage.insert([record]);
	 *
	 * 	// (re)index it by birth year
	 * 	storage.reindex('birthYear', record.birthYear, 1997, record.id);
	 * 	console.log(record.birthYear) // 1997
	 * 	</code></pre>
	 *
	 * 	**Reindex record that was indexed before**
	 * 	___________________
	 * 	<pre><code>// insert a record that is indexed by 'birthYear'
	 * 	const record = { id: 1, birthYear: 2000 };
	 * 	storage.insert([record]);
	 *
	 * 	// reindex it by birth year
	 * 	storage.reindex('birthYear', record.birthYear, 1997, record.id);
	 * 	console.log(record.birthYear) // 1997
	 * 	</code></pre>
	 *
	 * 	**De-index record that was indexed before**
	 * 	___________________
	 * 	<pre><code>// insert a record that is indexed by 'birthYear'
	 * 	const record = { id: 1, birthYear: 2000 };
	 * 	storage.insert([record]);
	 *
	 * 	// de-index it by birth year
	 * 	storage.reindex('birthYear', record.birthYear, null, record.id);
	 * 	console.log(record.birthYear) // null
	 * 	</code></pre>
	 *
	 * @param indexName Name of the index.
	 * @param oldValue  Old value of the index. It is used for record retrieval.
	 * @param newValue  The updated value of the index. Used for actual reindexing.
	 * @param matcher   Predicate that matches record, indexed property of which has been changed.
	 */
	public reindex(indexName: IndexName<IndexedRecord>, oldValue: IndexValue, newValue: IndexValue, matcher: UnaryPredicate<IndexedRecord> | IndexValue): void {
		if (indexName === PK_INDEX_NAME) {
			throw createException(ErrorCodes.REINDEX_OF_PRIMARY_KEY_NOT_ALLOWED, `Can't reindex primary index '${indexName}' value.`);
		}

		if (oldValue === newValue) {
			throw createException(ErrorCodes.REINDEXING_SAME_VALUE, `New and old values for index '${indexName}' are the same: ${JSON.stringify(oldValue)}.`);
		}

		if (oldValue == null) {
			if (newValue != null) {
				// creation

				if (matcher instanceof Function) {
					throw createException(
						ErrorCodes.PRIMARY_KEY_VALUE_REQUIRED,
						`Matcher needs to be primary key value when indexing record that was not indexed before. Context: index '${indexName}', new value '${JSON.stringify(
							newValue
						)}'.`
					);
				}

				const primaryIndex = this.readIndex(PK_INDEX_NAME);

				const record = primaryIndex.get(matcher);
				if (record == null || record.length !== 1) {
					throw createException(ErrorCodes.RECORD_NOT_FOUND, `No record found for index '${PK_INDEX_NAME} with matching value '${matcher}'.`);
				}

				setProperty(record[0], indexName, IndexedStore.assertIndexValue(indexName, newValue, record[0]));

				const storageIndex = this.readIndex(indexName);
				IndexedStore.indexRecordBy(record[0], newValue, storageIndex);
			}
		} else {
			// removal

			const records = this.read(indexName, oldValue);
			const predicate = matcher instanceof Function ? matcher : (record: IndexedRecord) => record[PK_INDEX_NAME] === matcher;

			const removed = IndexedStore.removeRecord(records, predicate);
			if (removed == null) {
				throw createException(
					ErrorCodes.RECORD_NOT_FOUND,
					`Failed to de-index record from index '${indexName}' with value '${oldValue}', because it wasn't found.`
				);
			}

			if (newValue != null) {
				// update

				setProperty(removed, indexName, IndexedStore.assertIndexValue(indexName, newValue, removed));

				const storageIndex = this.readIndex(indexName);
				IndexedStore.indexRecordBy(removed, newValue, storageIndex);
			} else {
				setProperty(removed, indexName, newValue);
			}
		}
	}

	/**
	 * Removes all records from storage and leaves it empty. <br> Notice that indexes are not
	 * removed, only their associated records are deleted.
	 */
	public clear(): void {
		for (const index of this.indexRepo.values()) {
			index.clear();
		}
	}

	/**
	 * Create new indexes for a set of record properties. <br> When storage already contains
	 * records, they will be indexed for newly defined indexes.
	 *
	 * @param newIndexProperties Name of properties that need to be indexed.
	 */
	public createIndexes(newIndexProperties: Array<IndexName<IndexedRecord>>): void {
		IndexedStore.defineIndexes(this.indexRepo, newIndexProperties);

		let newIndex: Index<IndexedRecord>;
		let indexValue: IndexValue;

		for (const newIndexProperty of newIndexProperties) {
			newIndex = this.indexRepo.get(newIndexProperty)!;
			for (const record of this) {
				indexValue = getProperty(record, newIndexProperty);

				IndexedStore.assertIndexValue(newIndexProperty, indexValue, record);
				IndexedStore.indexRecordBy(record, indexValue, newIndex);
			}
		}
	}

	/**
	 * Remove index from storage. <br> Notice that records are not removed, and can be found by
	 * another existing indexes.
	 *
	 * @param   indexName Name of the index.
	 *
	 * @returns           Whether index was removed or not.
	 */
	public dropIndex(indexName: IndexName<IndexedRecord>): boolean {
		if (indexName === PK_INDEX_NAME) {
			throw createException(ErrorCodes.DROPPING_OF_PRIMARY_INDEX_NOT_ALLOWED, `Primary index '${indexName}' can't be dropped.`);
		}
		return this.indexRepo.delete(indexName);
	}

	/** Remove all indexes, except the primary one. */
	public dropIndexes(): void {
		for (const [indexName, index] of this.indexRepo) {
			if (indexName !== PK_INDEX_NAME) {
				index.clear();
				this.indexRepo.delete(indexName);
			}
		}
	}

	/**
	 * Map a set of records. <br> When index related params are not specified, will map all of the
	 * records.
	 *
	 * @param   mapper    Mapping function.
	 * @param   onIndex   Index from were documents need to be retrieved.
	 * @param   withValue Value of that index.
	 *
	 * @returns           List of mapped records.
	 */
	public map<MappedType>(mapper: Mapper<IndexedRecord, MappedType>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexValue): Array<MappedType> {
		if (onIndex == null) {
			onIndex = PK_INDEX_NAME;
		}

		const index = IndexedStore.assertIndex(onIndex, this.indexRepo.get(onIndex));

		if (withValue != null) {
			let records: Optional<Array<IndexedRecord>>;
			if ((records = index.get(withValue)) != null) {
				return records.map(mapper);
			}

			return [];
		}

		let mappings = new Array<MappedType>();
		for (const indexRecords of index.values()) {
			mappings = mappings.concat(indexRecords.map(mapper));
		}

		return mappings;
	}

	/**
	 * Filter a set of documents. <br> When index related params are not specified, will apply
	 * `predicate` over all records.
	 *
	 * @param   predicate Predicate function.
	 * @param   onIndex   Index from were documents need to be retrieved.
	 * @param   withValue Value of that index.
	 *
	 * @returns           List of filtered records.
	 */
	public filter(predicate: UnaryPredicate<IndexedRecord>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexValue): Array<IndexedRecord> {
		if (onIndex == null) {
			onIndex = PK_INDEX_NAME;
		}

		const index = IndexedStore.assertIndex(onIndex, this.indexRepo.get(onIndex));

		if (withValue != null) {
			let records: Optional<Array<IndexedRecord>>;
			if ((records = index.get(withValue)) != null) {
				return records.filter(predicate);
			}

			return [];
		}

		const filtered = new Array<IndexedRecord>();
		for (const indexRecords of index.values()) {
			for (const record of indexRecords) {
				if (predicate(record)) {
					filtered.push(record);
				}
			}
		}

		return filtered;
	}

	/**
	 * Find a single record from storage. <br> When index related params are not specified, will
	 * apply `predicate` over all records.
	 *
	 * @param   predicate Predicate function.
	 * @param   onIndex   Index from were documents need to be retrieved.
	 * @param   withValue Value of that index.
	 *
	 * @returns           Record matching search criteria, if found.
	 */
	public find(predicate: UnaryPredicate<IndexedRecord>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexValue): Optional<IndexedRecord> {
		if (onIndex == null) {
			onIndex = PK_INDEX_NAME;
		}

		const index = IndexedStore.assertIndex(onIndex, this.indexRepo.get(onIndex));

		if (withValue != null) {
			let records: Optional<Array<IndexedRecord>>;
			if ((records = index.get(withValue)) != null) {
				return records.find(predicate);
			}

			return undefined;
		}

		for (const indexRecords of index.values()) {
			for (const record of indexRecords) {
				if (predicate(record)) {
					return record;
				}
			}
		}

		return undefined;
	}

	/**
	 * Get number of records stored under `indexName`.
	 *
	 * @param indexName Name of the index.
	 */
	public getIndexRecordsCount(indexName: IndexName<IndexedRecord>): number {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));

		let counter = 0;
		for (const indexRecords of index.values()) {
			counter += indexRecords.length;
		}

		return counter;
	}

	/** Get number of records present in the storage. */
	public get size(): number {
		return IndexedStore.assertIndex(PK_INDEX_NAME, this.indexRepo.get(PK_INDEX_NAME)).size;
	}

	/** Get names of indexed properties. */
	public get indexes(): Array<IndexName<IndexedRecord>> {
		return Array.from(this.indexRepo.keys());
	}

	/**
	 * Get a view of all records from storage.
	 *
	 * @returns Array of all records. Array can be modified by client, as it is created on each
	 *   method call.
	 */
	public get values(): Array<IndexedRecord> {
		const primaryIndex = IndexedStore.assertIndex(PK_INDEX_NAME, this.indexRepo.get(PK_INDEX_NAME));
		const records = new Array(primaryIndex.size);

		let i = 0;
		for (const record of primaryIndex.values()) {
			[records[i++]] = record;
		}

		return records;
	}

	/** Iterate over records from storage. */
	[Symbol.iterator](): Iterator<IndexedRecord> {
		const primaryIndex = IndexedStore.assertIndex(PK_INDEX_NAME, this.indexRepo.get(PK_INDEX_NAME));
		const iterator = primaryIndex[Symbol.iterator]();

		return {
			next(): IteratorResult<IndexedRecord> {
				const entry = iterator.next();
				return {
					done: entry.done as any,
					value: entry.value && entry.value[1][0]
				};
			}
		};
	}

	private getIndexRecords(indexName: IndexName<IndexedRecord>, indexValue: IndexValue): Optional<Array<IndexedRecord>> {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
		return index.get(indexValue);
	}

	private static defineIndexes<R>(indexes: IndexRepo<R>, indexNames: ReadonlyArray<IndexName<R>>): void {
		let i = indexNames.length;
		while (i--) {
			if (indexes.has(indexNames[i])) {
				throw createException(ErrorCodes.INDEX_EXISTS, `Index '${String(indexNames[i])} has been redefined already.`);
			}
			indexes.set(indexNames[i], new Map<IndexValue, Array<R>>());
		}
	}

	private static assertIndex<R>(indexName: IndexName<R>, index?: Index<R>): Index<R> | never {
		if (index == null) {
			throw createException(ErrorCodes.INDEX_NOT_FOUND, `Property '${indexName}' is not indexed.`);
		}
		return index;
	}

	private static assertRecordIndexes<R>(record: R, indexes: ReadonlyArray<IndexName<R>>): R | never {
		for (const indexName of indexes) {
			IndexedStore.assertIndexValue(indexName, getProperty(record as unknown as ObjMap, indexName), record);
		}
		return record;
	}

	private static assertIndexValue<R>(indexName: IndexName<R>, value: IndexValue, record: R): IndexValue | never {
		if (value == null) {
			if (indexName === PK_INDEX_NAME) {
				throw createException(
					ErrorCodes.NULLABLE_PRIMARY_KEY_CANNOT_BE_INDEXED,
					`Can't index record '${JSON.stringify(record)}' which has a nullable primary key.`
				);
			}
			return value; // null values for other indexes are valid
		}

		switch (typeof value) {
			case 'string':
			case 'number':
				return value;
			default:
				throw createException(
					ErrorCodes.INDEX_PROPERTY_INVALID_TYPE,
					`Index property '${String(indexName)}' is allowed to have a 'string' or 'number' value. Given: ${JSON.stringify(value)}`
				);
		}
	}

	private static assertNonNullableIndexValue<R>(indexName: IndexName<R>, indexValue: IndexValue): NonNullable<IndexValue> | never {
		if (indexValue == null) {
			throw createException(
				ErrorCodes.NULLABLE_INDEX_VALUE_NOT_ALLOWED,
				`Nullable index value is not allowed in current context for index name '${indexName}'. Given: ${indexValue}`
			);
		}
		return indexValue;
	}

	private static indexRecordBy<R>(record: R, value: IndexValue, index: Index<R>): void {
		if (value == null) {
			return; // do not index nullables
		}

		const records = index.get(value);
		if (records == null) {
			index.set(value, [record]);
		} else {
			records.push(record);
		}
	}

	private static removeRecord<IndexedRecord>(records: Array<IndexedRecord>, predicate: UnaryPredicate<IndexedRecord>): Optional<IndexedRecord> {
		const recordPosition = records.findIndex(predicate);
		if (recordPosition === -1) {
			return undefined;
		}

		const record = records[recordPosition];
		records.splice(recordPosition, 1);
		return record;
	}

	private static removeIndexedRecordBy<R>(record: R, value: IndexValue, index: Index<R>): void {
		if (value == null) {
			return; // this property was not indexed
		}

		const records = index.get(value);
		if (records == null) {
			return;
		}

		let i = records.length;
		while (i--) {
			if (records[i] === record) {
				records.splice(i, 1);
				return;
			}
		}
	}
}

export { IndexedStore, type IndexedStoreOptions };
