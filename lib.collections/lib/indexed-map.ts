import objectPath from 'object-path';
import { Nullable, UnaryPredicate } from '@thermopylae/core.declarations';
import { createError, ErrorCodes } from './error';

type IndexName = Exclude<PropertyKey, symbol>;
type IndexableValue = string | number;

type Index<Recordable> = Map<IndexableValue, Array<Recordable>>;

type IndexRepo<Recordable> = Map<IndexName, Index<Recordable>>;

interface IndexedStoreOptions {
	indexes?: ReadonlyArray<IndexName>;
}

class IndexedStore<PrimaryKey extends PropertyKey, Recordable extends NonNullable<Record<PropertyKey, any>>> {
	private readonly storage: Map<PrimaryKey, Recordable>;

	private readonly indexes: IndexRepo<Recordable>;

	public constructor(options: IndexedStoreOptions) {
		this.storage = new Map<PrimaryKey, Recordable>();
		this.indexes = new Map<IndexName, Index<Recordable>>();

		if (options.indexes) {
			IndexedStore.defineIndexes(this.indexes, ...options.indexes);
		}
	}

	public set(primaryKey: PrimaryKey, record: Recordable): this {
		const proxy = new Proxy<Recordable>(record, {
			set: (target: Recordable, propName: IndexName, newValue: any): boolean => {
				const index = this.indexes.get(propName);

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
			deleteProperty: (target: Recordable, propName: IndexName): boolean => {
				const index = this.indexes.get(propName);

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
			defineProperty: (target: Recordable, propName: IndexName, attributes: PropertyDescriptor): boolean => {
				const index = this.indexes.get(propName);

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
		for (const [indexName, index] of this.indexes) {
			indexValue = objectPath.get(record, indexName);
			IndexedStore.indexValue(indexName, index, indexValue, proxy);
		}

		this.storage.set(primaryKey, proxy);

		return this;
	}

	public get(primaryKey: PrimaryKey): Recordable | undefined {
		return this.storage.get(primaryKey);
	}

	public getByIndex(indexName: IndexName, indexValue: IndexableValue): Array<Recordable> {
		return IndexedStore.assertIndex(indexName, this.indexes.get(indexName)).get(indexValue) || [];
	}

	public getIndex(indexName: IndexName): Index<Recordable> {
		return IndexedStore.assertIndex(indexName, this.indexes.get(indexName));
	}

	public has(primaryKey: PrimaryKey): boolean {
		return this.storage.has(primaryKey);
	}

	public hasByIndex(indexName: IndexName, indexValue: IndexableValue): boolean {
		return IndexedStore.assertIndex(indexName, this.indexes.get(indexName)).has(indexValue);
	}

	public hasIndex(indexName: IndexName): boolean {
		return this.indexes.has(indexName);
	}

	public delete(primaryKey: PrimaryKey): boolean {
		const record = this.storage.get(primaryKey);
		if (record == null) {
			return false;
		}

		for (const [indexName, index] of this.indexes) {
			IndexedStore.removeIndexedValue(index, objectPath.get(record, indexName), record);
		}

		return this.storage.delete(primaryKey);
	}

	public deleteByIndex(primaryKey: PrimaryKey, indexName: IndexName, indexValue: IndexableValue, predicate: UnaryPredicate<Recordable>): boolean {
		const index = IndexedStore.assertIndex(indexName, this.indexes.get(indexName));

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

		for (const [registryIndexName, registryIndex] of this.indexes) {
			IndexedStore.removeIndexedValue(registryIndex, objectPath.get(record, registryIndexName), record);
		}

		return this.storage.delete(primaryKey);
	}

	public clear(): void {
		this.storage.clear();
		for (const index of this.indexes.values()) {
			index.clear();
		}
	}

	forEach(callbackfn: (value: Recordable, key: PrimaryKey, map: Map<PrimaryKey, Recordable>) => void, thisArg?: any): void;

	readonly size: number;

	private static defineIndexes<R>(indexes: IndexRepo<R>, ...indexNames: ReadonlyArray<IndexName>): void {
		let i = indexNames.length;
		while (i--) {
			if (indexes.has(indexNames[i])) {
				throw createError(ErrorCodes.REDEFINITION, `Index '${String(indexNames[i])} has been redefined already.`);
			}
			indexes.set(indexNames[i], new Map<IndexableValue, Array<R>>());
		}
	}

	private static assertIndex<R>(indexName: IndexName, index?: Index<R>): Index<R> | never {
		if (index == null) {
			throw createError(ErrorCodes.NOT_FOUND, `Property '${indexName} is not indexed.`);
		}
		return index;
	}

	private static assertIndexableValue(indexName: IndexName, value: IndexableValue): IndexableValue | never {
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

	private static indexValue<R>(indexName: IndexName, index: Index<R>, value: IndexableValue, recordProxy: R): void {
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

export { IndexedMap };
