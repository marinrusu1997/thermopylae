import { Undefinable } from '@thermopylae/core.declarations';
import { ArrayObjectPool, ObjectResource } from '@thermopylae/lib.pool';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';

class EntryPoolCacheBackend<Key, Value, Entry extends CacheEntry<Value> = CacheEntry<Value>> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, ObjectResource<Entry>>;

	private readonly entryPool: ArrayObjectPool<Entry>;

	public constructor(capacity: number) {
		this.store = new Map<Key, ObjectResource<Entry>>();
		this.entryPool = new ArrayObjectPool<Entry>({
			capacity,
			initializer(entry, args) {
				[entry.value] = args;
			},
			deInitializer(entry) {
				entry.value = undefined!; // let GC collect the value
			}
		});
	}

	public get(key: Key): Undefinable<Entry> {
		const objectResource = this.store.get(key);
		if (objectResource == null) {
			return undefined;
		}
		return objectResource.value;
	}

	public has(key: Key): boolean {
		return this.store.has(key);
	}

	public set(key: Key, value: Value): Entry {
		const objectResource = this.entryPool.acquire(value);
		this.store.set(key, objectResource);
		return objectResource.value;
	}

	public del(key: Key): boolean {
		const objectResource = this.store.get(key);
		if (!objectResource) {
			return false;
		}

		this.entryPool.release(objectResource);
		return this.store.delete(key);
	}

	public clear(): void {
		this.store.clear();
		this.entryPool.releaseAll();
	}

	public get size(): number {
		return this.store.size;
	}

	public [Symbol.iterator](): IterableIterator<[Key, Entry]> {
		return {
			// @ts-ignore
			__iter__: this.store[Symbol.iterator](),
			next(): IteratorResult<[Key, Entry]> {
				// @ts-ignore
				// eslint-disable-next-line no-underscore-dangle
				const res = this.__iter__.next() as IteratorResult<[Key, ObjectResource<Entry>]>;
				if (res.done) {
					// @ts-ignore
					// eslint-disable-next-line no-underscore-dangle
					this.__iter__ = null!; // prevent leaks
					return res;
				}
				// @ts-ignore
				res.value[1] = res.value[1].value;
				return (res as unknown) as IteratorResult<[Key, Entry]>;
			}
		};
	}

	public keys(): IterableIterator<Key> {
		return this.store.keys();
	}

	public values(): IterableIterator<Entry> {
		let iter = this.store.values();
		// @ts-ignore
		return {
			[Symbol.iterator](): IterableIterator<Entry> {
				// @ts-ignore
				return {
					next(): IteratorResult<Entry> {
						// @ts-ignore
						const res = iter.next() as IteratorResult<ObjectResource<Entry>>;
						if (res.done) {
							iter = null!; // prevent leaks
							return res;
						}
						// @ts-ignore
						res.value = res.value.value;
						return (res as unknown) as IteratorResult<Entry>;
					}
				};
			}
		};
	}
}

export { EntryPoolCacheBackend };
