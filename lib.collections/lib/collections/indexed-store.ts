import objectPath from 'object-path';
import { Nullable, UnaryPredicate } from '@thermopylae/core.declarations';
import { createError, ErrorCodes } from '../error';

const PRIMARY_KEY_NAME = 'id';

type IndexName<Recordable> = Exclude<keyof Recordable, symbol> | Exclude<PropertyKey, symbol>;
type IndexableValue = string | number;

type Index<Recordable> = Map<IndexableValue, Array<Recordable>>;

type IndexRepo<Recordable> = Map<IndexName<Recordable>, Index<Recordable>>;

interface IndexedStoreOptions<Recordable> {
	indexes?: ReadonlyArray<IndexName<Recordable>>;
}

interface IndexedRecord extends Record<PropertyKey, any> {
	readonly [PRIMARY_KEY_NAME]: IndexableValue;
}

class IndexedStore<Recordable extends IndexedRecord> {
	private readonly indexRepo: IndexRepo<Recordable>;

	public constructor(options?: IndexedStoreOptions<Recordable>) {
		this.indexRepo = new Map<IndexName<Recordable>, Index<Recordable>>();

		const indexes = ((options && options.indexes) || []).concat(PRIMARY_KEY_NAME);
		IndexedStore.defineIndexes(this.indexRepo, indexes);
	}

	public save(...records: Array<Recordable>): void {
		for (const record of records) {
			if (this.indexRepo.get(PRIMARY_KEY_NAME)!.has(record.id)) {
				throw createError(ErrorCodes.REDEFINITION, `Record with primary key '${record.id}' has been added already.`);
			}

			const proxy = new Proxy<Recordable>(record, {
				set: (target: Recordable, propName: IndexName<Recordable>, newValue: any): boolean => {
					const index = this.indexRepo.get(propName);

					if (index != null) {
						if (target !== record) {
							throw createError(
								ErrorCodes.NOT_ALLOWED,
								`Setting property index '${propName}' which is not on the first level in properties tree is forbidden.`
							);
						}

						// @ts-ignore
						const oldValue = target[propName];

						if (newValue === oldValue) {
							return true;
						}

						IndexedStore.removeIndexedValue(index, oldValue, proxy);
						IndexedStore.indexValue(propName, index, newValue, proxy);
					}

					return true;
				},
				deleteProperty: (target: Recordable, propName: IndexName<Recordable>): boolean => {
					const index = this.indexRepo.get(propName);

					if (index != null) {
						if (target !== record) {
							throw createError(
								ErrorCodes.NOT_ALLOWED,
								`Deleting property index '${propName}' which is not on the first level in properties tree is forbidden.`
							);
						}

						// @ts-ignore
						const oldValue = target[propName];
						IndexedStore.removeIndexedValue(index, oldValue, proxy);
					}

					return true;
				},
				defineProperty: (target: Recordable, propName: IndexName<Recordable>, attributes: PropertyDescriptor): boolean => {
					const index = this.indexRepo.get(propName);

					if (index != null) {
						if (target !== record) {
							throw createError(
								ErrorCodes.NOT_ALLOWED,
								`Defining property index '${propName}' which is not on the first level in properties tree is forbidden.`
							);
						}

						// FIXME what if we have old value when method is invoked?
						IndexedStore.indexValue(propName, index, attributes.value, proxy);
					}

					return true;
				}
			});

			let indexValue;
			for (const [indexName, index] of this.indexRepo) {
				indexValue = objectPath.get(record, indexName);
				IndexedStore.indexValue(indexName, index, indexValue, proxy);
			}
		}
	}

	public read(indexName: IndexName<Recordable>, indexValue: IndexableValue): Array<Recordable> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName)).get(indexValue) || [];
	}

	public readIndex(indexName: IndexName<Recordable>): Index<Recordable> {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));
	}

	public contains(indexName: IndexName<Recordable>, indexValue: IndexableValue): boolean {
		return IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName)).has(indexValue);
	}

	public containsIndex(indexName: IndexName<Recordable>): boolean {
		return this.indexRepo.has(indexName);
	}

	public remove(indexName: IndexName<Recordable>, indexValue: IndexableValue, predicate: UnaryPredicate<Recordable>): boolean {
		const index = IndexedStore.assertIndex(indexName, this.indexRepo.get(indexName));

		const records = index.get(indexValue);
		if (records == null) {
			return false;
		}

		let record: Nullable<Recordable> = null;
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

	public createIndexes(indexNames: ReadonlyArray<IndexName<Recordable>>): void {
		IndexedStore.defineIndexes(this.indexRepo, indexNames);

		for (const indexName of indexNames) {
			const index = this.indexRepo.get(indexName)!;
			for (const primaryKeyRecords of this.indexRepo.get(PRIMARY_KEY_NAME)!.values()) {
				IndexedStore.indexValue(indexName, index, objectPath.get(primaryKeyRecords[0], indexName), primaryKeyRecords[0]);
			}
		}
	}

	public dropIndex(indexName: IndexName<Recordable>): boolean {
		if (indexName === PRIMARY_KEY_NAME) {
			this.clear();
			return true;
		}
		return this.indexRepo.delete(indexName);
	}

	public dropIndexes(): void {
		for (const [indexName, index] of this.indexRepo) {
			if (indexName !== PRIMARY_KEY_NAME) {
				index.clear();
				this.indexRepo.delete(indexName);
			}
		}
	}

	public get size(): number {
		return this.indexRepo.get(PRIMARY_KEY_NAME)!.size;
	}

	public get indexes(): ReadonlyArray<IndexName<Recordable>> {
		return Array.from(this.indexRepo.keys());
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

export { IndexedStore };
