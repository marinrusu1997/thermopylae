import { Undefinable } from '@thermopylae/core.declarations';
import { ArrayObjectPool, ObjectResource } from '@thermopylae/lib.pool';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';

/**
 * Backend which has a pool of reusable {@link CacheEntry}. Pool can have a fixed or dynamic size.
 * If pool has a fixed size, trying to insert keys above that size will result in an error. <br/>
 * Each time *key* is inserted, a free {@link CacheEntry} is taken from pool to hold the *value*.
 * When *key* is deleted/expires/cleared, it's according {@link CacheEntry} is returned to pool and can be used by another *key*.
 *
 * @template Key	Type of the *key*.
 * @template Value	Type of the *value*.
 * @template Entry	Type of the cache entry. <br/>
 * 					Defaults to {@link CacheEntry}.
 */
class EntryPoolCacheBackend<Key, Value, Entry extends CacheEntry<Key, Value> = CacheEntry<Key, Value>> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, ObjectResource<Entry>>;

	private readonly entryPool: ArrayObjectPool<Entry>;

	/**
	 * @param capacity	Backend capacity. <br/>
	 * 					When given, cache will not grow above *capacity* (i.e. will have a fixed size). <br/>
	 * 					If you omit this argument, backend will have a dynamic size.
	 */
	public constructor(capacity?: number) {
		this.store = new Map<Key, ObjectResource<Entry>>();
		this.entryPool = new ArrayObjectPool<Entry>({
			// @fixme HACK: we add 1 so that eviction policies get a chance to evict entries that overflow the cache
			capacity: capacity ? capacity + 1 : capacity,
			initializer(entry, args) {
				entry.key = args[0] as Key;
				entry.value = args[1] as Value;
			},
			deInitializer(entry) {
				entry.key = undefined!; // let GC collect the value
				entry.value = undefined!; // let GC collect the value
			}
		});
	}

	/**
	 * @inheritDoc
	 */
	public get(key: Key): Undefinable<Entry> {
		const objectResource = this.store.get(key);
		if (objectResource == null) {
			return undefined;
		}
		return objectResource.value;
	}

	/**
	 * @inheritDoc
	 */
	public has(key: Key): boolean {
		return this.store.has(key);
	}

	/**
	 * @inheritDoc
	 */
	public set(key: Key, value: Value): Entry {
		const objectResource = this.entryPool.acquire(key, value);
		this.store.set(key, objectResource);
		return objectResource.value;
	}

	/**
	 * @inheritDoc
	 */
	public del(entry: Entry): void {
		const objectResource = this.store.get(entry.key)!;
		this.store.delete(entry.key);
		this.entryPool.release(objectResource);
	}

	/**
	 * @inheritDoc
	 */
	public clear(): void {
		this.store.clear();
		this.entryPool.releaseAll();
	}

	/**
	 * @inheritDoc
	 */
	public get size(): number {
		return this.store.size;
	}

	/**
	 * @inheritDoc
	 */
	public [Symbol.iterator](): IterableIterator<[Key, Entry]> {
		return {
			// @ts-ignore The typings are correct
			__iter__: this.store[Symbol.iterator](),
			next(): IteratorResult<[Key, Entry]> {
				// @ts-ignore The typings are correct
				const res = this.__iter__.next() as IteratorResult<[Key, ObjectResource<Entry>]>;
				if (res.done) {
					// @ts-ignore The typings are correct
					this.__iter__ = null!; // prevent leaks
					return res;
				}
				// @ts-ignore The typings are correct
				res.value[1] = res.value[1].value;
				return res as unknown as IteratorResult<[Key, Entry]>;
			}
		};
	}

	/**
	 * @inheritDoc
	 */
	public keys(): IterableIterator<Key> {
		return this.store.keys();
	}

	/**
	 * @inheritDoc
	 */
	public values(): IterableIterator<Entry> {
		let iter = this.store.values();
		// @ts-ignore The typings are correct
		return {
			[Symbol.iterator](): IterableIterator<Entry> {
				// @ts-ignore The typings are correct
				return {
					next(): IteratorResult<Entry> {
						// @ts-ignore The typings are correct
						const res = iter.next() as IteratorResult<ObjectResource<Entry>>;
						if (res.done) {
							iter = null!; // prevent leaks
							return res;
						}
						// @ts-ignore The typings are correct
						res.value = res.value.value;
						return res as unknown as IteratorResult<Entry>;
					}
				};
			}
		};
	}
}

export { EntryPoolCacheBackend };
