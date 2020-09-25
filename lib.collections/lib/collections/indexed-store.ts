import dotprop from 'dot-prop';
import { Mapper, Nullable, ObjMap, Optional, UnaryPredicate } from '@thermopylae/core.declarations';
import { createException, ErrorCodes } from '../error';

const PRIMARY_KEY_INDEX = 'id';

type IndexName<Recordable> = Exclude<keyof Recordable, symbol | number> | string;
type IndexValue = Optional<Nullable<string | number>>;

type Index<Recordable> = Map<IndexValue, Array<Recordable>>;

type IndexRepo<Recordable> = Map<IndexName<Recordable>, Index<Recordable>>;

interface IndexedStoreOptions<Recordable> {
	indexes?: ReadonlyArray<IndexName<Recordable>>;
}

interface Recordable extends Record<PropertyKey, any> {
	readonly [PRIMARY_KEY_INDEX]: IndexValue;
}

class IndexedStore<IndexedRecord extends Recordable> implements Iterable<IndexedRecord> {
	private readonly indexRepo: IndexRepo<IndexedRecord>;

	public constructor(options?: IndexedStoreOptions<IndexedRecord>) {
		this.indexRepo = new Map<IndexName<IndexedRecord>, Index<IndexedRecord>>();

		const indexes = ((options && options.indexes) || []).concat(PRIMARY_KEY_INDEX);
		IndexedStore.defineIndexes(this.indexRepo, indexes);
	}

	public insert(...records: Array<IndexedRecord>): void {
		const { indexes } = this;

		for (const record of records) {
			if (this.indexRepo.get(PRIMARY_KEY_INDEX)!.has(record.id)) {
				throw createException(ErrorCodes.REDEFINITION, `Record with primary key '${record.id}' has been added already.`);
			}

			IndexedStore.assertRecordIndexes(record, indexes);

			for (const [indexName, index] of this.indexRepo) {
				IndexedStore.indexRecordBy(record, dotprop.get(record, indexName), index);
			}
		}
	}

	public read(indexName: IndexName<IndexedRecord>, indexValue: IndexValue): Array<IndexedRecord> {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
		return index.get(IndexedStore.assertNonNullableIndexValue(indexName, indexValue)) || [];
	}

	public readIndex(indexName: IndexName<IndexedRecord>): Index<IndexedRecord> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
	}

	public contains(indexName: IndexName<IndexedRecord>, indexValue: IndexValue): boolean {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
		return index.has(IndexedStore.assertNonNullableIndexValue(indexName, indexValue));
	}

	public containsIndex(indexName: IndexName<IndexedRecord>): boolean {
		return this.indexRepo.has(indexName);
	}

	public remove(indexName: IndexName<IndexedRecord>, indexValue: IndexValue, predicate?: UnaryPredicate<IndexedRecord>): Optional<IndexedRecord> {
		indexValue = IndexedStore.assertNonNullableIndexValue(indexName, indexValue);

		if (indexName !== PRIMARY_KEY_INDEX) {
			if (predicate == null) {
				throw createException(ErrorCodes.REQUIRED, `Predicate is required when removing from index ${indexName}`);
			}
		} else {
			predicate = (record: IndexedRecord) => record[PRIMARY_KEY_INDEX] === indexValue;
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
			IndexedStore.removeIndexedRecordBy(record, dotprop.get(record, registryIndexName), registryIndex);
		}

		this.indexRepo.get(PRIMARY_KEY_INDEX)!.delete(record[PRIMARY_KEY_INDEX]);

		return record;
	}

	public reindex(indexName: IndexName<IndexedRecord>, oldValue: IndexValue, newValue: IndexValue, matcher: UnaryPredicate<IndexedRecord> | IndexValue): void {
		if (indexName === PRIMARY_KEY_INDEX) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Can't update primary index '${indexName}' value.`);
		}

		if (oldValue === newValue) {
			throw createException(ErrorCodes.NOT_ALLOWED, `New and old values for index '${indexName}' are the same: ${JSON.stringify(oldValue)}.`);
		}

		if (oldValue == null) {
			if (newValue != null) {
				// creation

				if (matcher instanceof Function) {
					throw createException(
						ErrorCodes.REQUIRED,
						`Matcher needs to be primary key index when indexing record that was not indexed before. Context: index '${indexName}', new value '${JSON.stringify(
							newValue
						)}'.`
					);
				}

				const primaryIndex = this.readIndex(PRIMARY_KEY_INDEX);

				const record = primaryIndex.get(matcher);
				if (record == null || record.length !== 1) {
					throw createException(ErrorCodes.NOT_FOUND, `No record found for index '${PRIMARY_KEY_INDEX} with matching value '${matcher}'.`);
				}

				IndexedStore.assertIndexValue(indexName, newValue, record[0]);
				const storageIndex = this.readIndex(indexName);
				IndexedStore.indexRecordBy(record[0], newValue, storageIndex);
			}
		} else {
			// removal

			const records = this.read(indexName, oldValue);
			const predicate = matcher instanceof Function ? matcher : (record: IndexedRecord) => record[PRIMARY_KEY_INDEX] === matcher;

			const removed = IndexedStore.removeRecord(records, predicate);
			if (removed == null) {
				throw createException(
					ErrorCodes.NOT_FOUND,
					`Failed to de-index record from index '${indexName}' with value '${oldValue}', because it wasn't found.`
				);
			}

			if (newValue != null) {
				// update

				IndexedStore.assertIndexValue(indexName, newValue, removed);
				const storageIndex = this.readIndex(indexName);
				IndexedStore.indexRecordBy(removed, newValue, storageIndex);
			}
		}
	}

	public clear(): void {
		for (const index of this.indexRepo.values()) {
			index.clear();
		}
	}

	public createIndexes(newIndexProperties: ReadonlyArray<IndexName<IndexedRecord>>): void {
		IndexedStore.defineIndexes(this.indexRepo, newIndexProperties);

		let newIndex: Index<IndexedRecord>;
		let indexValue: IndexValue;

		for (const newIndexProperty of newIndexProperties) {
			newIndex = this.indexRepo.get(newIndexProperty)!;
			for (const record of this) {
				indexValue = dotprop.get(record, newIndexProperty);

				IndexedStore.assertIndexValue(newIndexProperty, indexValue, record);
				IndexedStore.indexRecordBy(record, indexValue, newIndex);
			}
		}
	}

	public dropIndex(indexName: IndexName<IndexedRecord>): boolean {
		if (indexName === PRIMARY_KEY_INDEX) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Primary index '${indexName}' can't be dropped.`);
		}
		return this.indexRepo.delete(indexName);
	}

	public dropIndexes(): void {
		for (const [indexName, index] of this.indexRepo) {
			if (indexName !== PRIMARY_KEY_INDEX) {
				index.clear();
				this.indexRepo.delete(indexName);
			}
		}
	}

	public map<MappedType>(mapper: Mapper<IndexedRecord, MappedType>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexValue): Array<MappedType> {
		if (onIndex == null) {
			onIndex = PRIMARY_KEY_INDEX;
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

	public filter(predicate: UnaryPredicate<IndexedRecord>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexValue): Array<IndexedRecord> {
		if (onIndex == null) {
			onIndex = PRIMARY_KEY_INDEX;
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

	public find(predicate: UnaryPredicate<IndexedRecord>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexValue): Optional<IndexedRecord> {
		if (onIndex == null) {
			onIndex = PRIMARY_KEY_INDEX;
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

	public getIndexRecordsCount(indexName: IndexName<IndexedRecord>): number {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));

		let counter = 0;
		for (const indexRecords of index.values()) {
			counter += indexRecords.length;
		}

		return counter;
	}

	public get size(): number {
		return IndexedStore.assertIndex(PRIMARY_KEY_INDEX, this.indexRepo.get(PRIMARY_KEY_INDEX)).size;
	}

	public get indexes(): ReadonlyArray<IndexName<IndexedRecord>> {
		return Array.from(this.indexRepo.keys());
	}

	public get values(): Array<IndexedRecord> {
		const primaryIndex = IndexedStore.assertIndex(PRIMARY_KEY_INDEX, this.indexRepo.get(PRIMARY_KEY_INDEX));
		const records = new Array(primaryIndex.size);

		let i = 0;
		for (const record of primaryIndex.values()) {
			[records[i++]] = record;
		}

		return records;
	}

	[Symbol.iterator](): Iterator<IndexedRecord> {
		const primaryIndex = IndexedStore.assertIndex(PRIMARY_KEY_INDEX, this.indexRepo.get(PRIMARY_KEY_INDEX));
		const iterator = primaryIndex[Symbol.iterator]();

		return {
			next(): IteratorResult<IndexedRecord> {
				const entry = iterator.next();
				return {
					done: entry.done,
					value: entry.value && entry.value[1]
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
				throw createException(ErrorCodes.REDEFINITION, `Index '${String(indexNames[i])} has been redefined already.`);
			}
			indexes.set(indexNames[i], new Map<IndexValue, Array<R>>());
		}
	}

	private static assertIndex<R>(indexName: IndexName<R>, index?: Index<R>): Index<R> | never {
		if (index == null) {
			throw createException(ErrorCodes.NOT_FOUND, `Property '${indexName} is not indexed.`);
		}
		return index;
	}

	private static assertRecordIndexes<R>(record: R, indexes: ReadonlyArray<IndexName<R>>): R | never {
		for (const indexName of indexes) {
			IndexedStore.assertIndexValue(indexName, dotprop.get((record as unknown) as ObjMap, indexName), record);
		}
		return record;
	}

	private static assertIndexValue<R>(indexName: IndexName<R>, value: IndexValue, record: R): IndexValue | never {
		if (value == null) {
			if (indexName === PRIMARY_KEY_INDEX) {
				throw createException(ErrorCodes.NOT_ALLOWED, `Can't index record '${JSON.stringify(record)}' which has a nullable primary key.`);
			}
			return value; // null values for other indexes are valid
		}

		switch (typeof value) {
			case 'string':
			case 'number':
				return value;
			default:
				throw createException(
					ErrorCodes.INVALID_TYPE,
					`Index property '${String(indexName)}' is allowed to have a 'string' or 'number' value. Given: ${JSON.stringify(value)}`
				);
		}
	}

	private static assertNonNullableIndexValue<R>(indexName: IndexName<R>, indexValue: IndexValue): NonNullable<IndexValue> | never {
		if (indexValue == null) {
			throw createException(
				ErrorCodes.INVALID_TYPE,
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

export { IndexedStore, IndexName, IndexValue, Recordable, PRIMARY_KEY_INDEX };
