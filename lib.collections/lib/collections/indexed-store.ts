import objectPath from 'object-path';
import { Nullable, Optional, UnaryPredicate } from '@thermopylae/core.declarations';
import { createError, ErrorCodes } from '../error';

const PRIMARY_KEY_INDEX = 'id';

type IndexName<Recordable> = Exclude<keyof Recordable, symbol> | Exclude<PropertyKey, symbol>;
type IndexableValue = string | number;

type Index<Recordable> = Map<IndexableValue, Array<Recordable>>;

type IndexRepo<Recordable> = Map<IndexName<Recordable>, Index<Recordable>>;

interface IndexedStoreOptions<Recordable> {
	indexes?: ReadonlyArray<IndexName<Recordable>>;
}

interface Recordable extends Record<PropertyKey, any> {
	readonly [PRIMARY_KEY_INDEX]: IndexableValue;
}

class IndexedStore<IndexedRecord extends Recordable> implements Iterable<IndexedRecord> {
	private readonly indexRepo: IndexRepo<IndexedRecord>;

	public constructor(options?: IndexedStoreOptions<IndexedRecord>) {
		this.indexRepo = new Map<IndexName<IndexedRecord>, Index<IndexedRecord>>();

		const indexes = ((options && options.indexes) || []).concat(PRIMARY_KEY_INDEX);
		IndexedStore.defineIndexes(this.indexRepo, indexes);
	}

	public save(...records: Array<IndexedRecord>): void {
		for (const record of records) {
			if (this.indexRepo.get(PRIMARY_KEY_INDEX)!.has(record.id)) {
				throw createError(ErrorCodes.REDEFINITION, `Record with primary key '${record.id}' has been added already.`);
			}

			let indexValue;
			for (const [indexName, index] of this.indexRepo) {
				indexValue = objectPath.get(record, indexName);
				IndexedStore.indexValue(indexName, index, indexValue, record);
			}
		}
	}

	public read(indexName: IndexName<IndexedRecord>, indexValue: IndexableValue): Array<IndexedRecord> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName)).get(indexValue) || [];
	}

	public readIndex(indexName: IndexName<IndexedRecord>): Index<IndexedRecord> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
	}

	public contains(indexName: IndexName<IndexedRecord>, indexValue: IndexableValue): boolean {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName)).has(indexValue);
	}

	public containsIndex(indexName: IndexName<IndexedRecord>): boolean {
		return this.indexRepo.has(indexName);
	}

	public updateIndex(
		indexName: IndexName<IndexedRecord>,
		predicate: UnaryPredicate<IndexedRecord>,
		oldValue: IndexableValue,
		newValue?: IndexableValue
	): boolean {
		if (indexName === PRIMARY_KEY_INDEX) {
			throw createError(ErrorCodes.NOT_ALLOWED, `Can't update primary index '${indexName}'.`);
		}

		if (oldValue === newValue) {
			return false;
		}

		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));

		const records = index.get(oldValue);
		if (records == null) {
			return false;
		}

		let record: Nullable<IndexedRecord> = null;
		let i = records.length;
		while (i--) {
			if (predicate(records[i])) {
				record = records[i];
				records.splice(i, 1);
				break;
			}
		}

		if (record == null) {
			return false;
		}

		if (newValue != null) {
			objectPath.set(record, indexName, newValue);
			IndexedStore.indexValue(indexName, index, newValue, record);
		}

		return true;
	}

	public remove(indexName: IndexName<IndexedRecord>, indexValue: IndexableValue, predicate?: UnaryPredicate<IndexedRecord>): boolean {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));

		const records = index.get(indexValue);
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

		let record: Nullable<IndexedRecord> = null;
		let i = records.length;
		while (i--) {
			if (predicate(records[i])) {
				record = records[i];
				records.splice(i, 1);
				break;
			}
		}

		if (record == null) {
			return false;
		}

		for (const [registryIndexName, registryIndex] of this.indexRepo) {
			IndexedStore.removeIndexedValue(registryIndex, objectPath.get(record, registryIndexName), record);
		}

		return true;
	}

	public clear(): void {
		for (const index of this.indexRepo.values()) {
			index.clear();
		}
	}

	public createIndexes(indexNames: ReadonlyArray<IndexName<IndexedRecord>>): void {
		IndexedStore.defineIndexes(this.indexRepo, indexNames);

		for (const indexName of indexNames) {
			const index = this.indexRepo.get(indexName)!;
			for (const primaryKeyRecords of this.indexRepo.get(PRIMARY_KEY_INDEX)!.values()) {
				IndexedStore.indexValue(indexName, index, objectPath.get(primaryKeyRecords[0], indexName), primaryKeyRecords[0]);
			}
		}
	}

	public dropIndex(indexName: IndexName<IndexedRecord>): boolean {
		if (indexName === PRIMARY_KEY_INDEX) {
			this.clear();
			return true;
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

	public filter(predicate: UnaryPredicate<IndexedRecord>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexableValue): Array<IndexedRecord> {
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

	public find(predicate: UnaryPredicate<IndexedRecord>, onIndex?: IndexName<IndexedRecord>, withValue?: IndexableValue): Optional<IndexedRecord> {
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
		return this.indexRepo.get(PRIMARY_KEY_INDEX)!.size;
	}

	public get indexes(): ReadonlyArray<IndexName<IndexedRecord>> {
		return Array.from(this.indexRepo.keys());
	}

	public get array(): ReadonlyArray<IndexedRecord> {
		const primaryIndex = IndexedStore.assertIndex(PRIMARY_KEY_INDEX, this.indexRepo.get(PRIMARY_KEY_INDEX));
		const records = new Array(primaryIndex.size);

		let i = 0;
		for (const record of primaryIndex.values()) {
			[records[i++]] = record;
		}

		return records;
	}

	[Symbol.iterator](): Iterator<IndexedRecord> {
		return this.array[Symbol.iterator]();
	}

	private static defineIndexes<R>(indexes: IndexRepo<R>, indexNames: ReadonlyArray<IndexName<R>>): void {
		let i = indexNames.length;
		while (i--) {
			if (indexes.has(indexNames[i])) {
				throw createError(ErrorCodes.REDEFINITION, `Index '${String(indexNames[i])} has been redefined already.`);
			}
			indexes.set(indexNames[i], new Map<IndexableValue, Array<R>>());
		}
	}

	private static assertIndex<R>(indexName: IndexName<R>, index?: Index<R>): Index<R> | never {
		if (index == null) {
			throw createError(ErrorCodes.NOT_FOUND, `Property '${indexName} is not indexed.`);
		}
		return index;
	}

	private static assertIndexableValue<R>(indexName: IndexName<R>, value: IndexableValue): IndexableValue | never {
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

	private static indexValue<R>(indexName: IndexName<R>, index: Index<R>, value: IndexableValue, recordProxy: R): void {
		if (value == null) {
			return; // do not index nullables
		}

		IndexedStore.assertIndexableValue(indexName, value);

		const records = index.get(value);
		if (records == null) {
			index.set(value, [recordProxy]);
		} else {
			records.push(recordProxy);
		}
	}

	private static removeIndexedValue<R>(index: Index<R>, value: IndexableValue, recordProxy: R): void {
		const records = index.get(value);
		if (records == null) {
			return;
		}

		let i = records.length;
		while (i--) {
			if (records[i] === recordProxy) {
				records.splice(i, 1);
				return;
			}
		}
	}
}

export { IndexedStore, IndexName, IndexableValue, PRIMARY_KEY_INDEX };
