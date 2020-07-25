import objectPath from 'object-path';
import { Mapper, Optional, UnaryPredicate } from '@thermopylae/core.declarations';
import { createError, ErrorCodes } from '../error';

const PRIMARY_KEY_INDEX = 'id';

type IndexName<Recordable> = Exclude<keyof Recordable, symbol> | Exclude<PropertyKey, symbol>;
type IndexValue = string | number;

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

	public save(...records: Array<IndexedRecord>): void {
		const { indexes } = this;

		for (const record of records) {
			if (this.indexRepo.get(PRIMARY_KEY_INDEX)!.has(record.id)) {
				throw createError(ErrorCodes.REDEFINITION, `Record with primary key '${record.id}' has been added already.`);
			}

			IndexedStore.assertRecordIndexes(record, indexes);

			for (const [indexName, index] of this.indexRepo) {
				IndexedStore.indexRecordBy(record, objectPath.get(record, indexName), index);
			}
		}
	}

	public read(indexName: IndexName<IndexedRecord>, indexValue: IndexValue): Array<IndexedRecord> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName)).get(indexValue) || [];
	}

	public readIndex(indexName: IndexName<IndexedRecord>): Index<IndexedRecord> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
	}

	public contains(indexName: IndexName<IndexedRecord>, indexValue: IndexValue): boolean {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName)).has(indexValue);
	}

	public containsIndex(indexName: IndexName<IndexedRecord>): boolean {
		return this.indexRepo.has(indexName);
	}

	public updateIndex(indexName: IndexName<IndexedRecord>, oldValue: IndexValue, newValue: IndexValue, predicate: UnaryPredicate<IndexedRecord>): boolean {
		if (oldValue === newValue) {
			return false;
		}

		if (indexName === PRIMARY_KEY_INDEX) {
			throw createError(ErrorCodes.NOT_ALLOWED, `Can't update primary index '${indexName}' value.`);
		}

		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));

		const records = index.get(oldValue);
		if (records == null) {
			return false;
		}

		const record = IndexedStore.removeRecord(records, predicate);
		if (record == null) {
			return false;
		}

		objectPath.set(record, indexName, newValue);
		IndexedStore.assertIndexValue(indexName, newValue);
		IndexedStore.indexRecordBy(record, newValue, index);

		return true;
	}

	public deIndex(indexName: IndexName<IndexedRecord>, indexValue: IndexValue, predicate: UnaryPredicate<IndexedRecord>): boolean {
		if (indexName === PRIMARY_KEY_INDEX) {
			throw createError(ErrorCodes.NOT_ALLOWED, `Can't de-index from primary index '${indexName}'.`);
		}

		const records = this.getIndexRecords(indexName, indexValue);
		if (records == null) {
			return false;
		}

		return IndexedStore.removeRecord(records, predicate) != null;
	}

	public remove(indexName: IndexName<IndexedRecord>, indexValue: IndexValue, predicate?: UnaryPredicate<IndexedRecord>): boolean {
		const records = this.getIndexRecords(indexName, indexValue);
		if (records == null) {
			return false;
		}

		if (indexName !== PRIMARY_KEY_INDEX) {
			if (predicate == null) {
				throw createError(ErrorCodes.REQUIRED, `Predicate is required when removing from index ${indexName}`);
			}
		} else {
			predicate = (record: IndexedRecord) => record[PRIMARY_KEY_INDEX] === indexValue;
		}

		const record = IndexedStore.removeRecord(records, predicate);

		if (record == null) {
			return false;
		}

		for (const [registryIndexName, registryIndex] of this.indexRepo) {
			IndexedStore.removeIndexedRecordBy(record, objectPath.get(record, registryIndexName), registryIndex);
		}

		return true;
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
				indexValue = objectPath.get(record, newIndexProperty);

				IndexedStore.assertIndexValue(newIndexProperty, indexValue);
				IndexedStore.indexRecordBy(record, indexValue, newIndex);
			}
		}
	}

	public dropIndex(indexName: IndexName<IndexedRecord>): boolean {
		if (indexName === PRIMARY_KEY_INDEX) {
			throw createError(ErrorCodes.NOT_ALLOWED, `Primary index '${indexName}' can't be dropped.`);
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
			return (index.get(withValue) || []).map(mapper);
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
			return (index.get(withValue) || []).filter(predicate);
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
			return (index.get(withValue) || []).find(predicate);
		}

		for (const indexRecords of index.values()) {
			for (const record of indexRecords) {
				if (predicate(record)) {
					return record;
				}
			}
		}
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
					value: entry.value && entry.value[0]
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
				throw createError(ErrorCodes.REDEFINITION, `Index '${String(indexNames[i])} has been redefined already.`);
			}
			indexes.set(indexNames[i], new Map<IndexValue, Array<R>>());
		}
	}

	private static assertIndex<R>(indexName: IndexName<R>, index?: Index<R>): Index<R> | never {
		if (index == null) {
			throw createError(ErrorCodes.NOT_FOUND, `Property '${indexName} is not indexed.`);
		}
		return index;
	}

	private static assertRecordIndexes<R>(record: R, indexes: ReadonlyArray<IndexName<R>>): R | never {
		for (const indexName of indexes) {
			// eslint-disable-next-line @typescript-eslint/ban-types
			IndexedStore.assertIndexValue(indexName, objectPath.get((record as unknown) as object, indexName));
		}
		return record;
	}

	private static assertIndexValue<R>(indexName: IndexName<R>, value: IndexValue): IndexValue | never {
		if (value == null) {
			if (indexName === PRIMARY_KEY_INDEX) {
				throw createError(ErrorCodes.NOT_ALLOWED, `Can't index record which has a nullable primary key.`);
			}
			return value; // null values for other indexes are valid
		}

		switch (typeof value) {
			case 'string':
			case 'number':
				return value;
			default:
				throw createError(
					ErrorCodes.INVALID_TYPE,
					`Index property '${String(indexName)}' is allowed to have a 'string' or 'number' value. Given: ${JSON.stringify(value)}`
				);
		}
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
