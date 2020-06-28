import { Undefinable } from '@thermopylae/core.declarations';
import { array } from '@thermopylae/lib.utils';
import { object as obj } from '@thermopylae/lib.pool';
import { CacheBackend, CacheEntry } from '../../contracts/sync/cache-backend';
import { NOT_FOUND_VALUE } from '../../constants';

class RecyclerBackend<Key, Value> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, CacheEntry<Value>>;

	private readonly entryPool: obj.ObjectPool<Value>;

	constructor(capacity?: number) {
		this.store = new Map<Key, CacheEntry<Value>>();
		this.entryPool = new obj.ObjectPool<Value>({
			capacity: capacity || Infinity,
			initialFreeShapes: capacity ? array.filledWith(capacity, undefined) : undefined,
			constructor(value) {
				return value;
			},
			destructor() {
				return undefined;
			},
			initializer(_previous, value: Value) {
				return value;
			}
		});
	}

	public get(key: Key): Undefinable<CacheEntry<Value>> {
		return this.store.get(key);
	}

	public set(key: Key, value: Value): CacheEntry<Value> {
		const handle = this.entryPool.acquire(value);
		this.store.set(key, handle);
		return handle;
	}

	public del(key: Key, entry: boolean): boolean | Undefinable<CacheEntry<Value>> {
		const handle = this.store.get(key);
		if (!handle) {
			return entry ? NOT_FOUND_VALUE : false;
		}

		this.entryPool.releaseHandle(handle);

		const deleted = this.store.delete(key);
		return entry ? handle : deleted;
	}

	public keys(): IterableIterator<Key> {
		return this.store.keys();
	}

	public clear(): void {
		this.store.clear();
		this.entryPool.releaseAll();
	}

	public get size(): number {
		return this.store.size;
	}

	[Symbol.iterator](): IterableIterator<[Key, CacheEntry<Value>]> {
		return this.store[Symbol.iterator]();
	}
}

export { RecyclerBackend };
