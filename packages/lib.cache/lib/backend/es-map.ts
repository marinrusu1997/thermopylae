import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';

/**
 * Backend which uses as underlying storage EcmaScript 6 Map.
 * It can be seen as a simple proxy over Map.
 * Each operation is forwarded to underlying Map instance.
 *
 * @template Key	Type of the *key*.
 * @template Value	Type of the *value*.
 * @template Entry	Type of the cache entry. <br/>
 * 					Defaults to {@link CacheEntry}.
 */
class EsMapCacheBackend<Key, Value, Entry extends CacheEntry<Value> = CacheEntry<Value>> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, Entry>;

	public constructor() {
		this.store = new Map<Key, Entry>();
	}

	/**
	 * @inheritDoc
	 */
	public get(key: Key): Undefinable<Entry> {
		return this.store.get(key);
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
		const entry = { value } as Entry;
		this.store.set(key, entry);
		return entry;
	}

	/**
	 * @inheritDoc
	 */
	public del(key: Key, entry: Entry): void {
		entry.value = undefined!; // let GC collect value
		this.store.delete(key);
	}

	/**
	 * @inheritDoc
	 */
	public clear(): void {
		return this.store.clear();
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
		return this.store[Symbol.iterator]();
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
		return this.store.values();
	}
}

export { EsMapCacheBackend };
