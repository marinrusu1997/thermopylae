import type { Undefinable } from '@thermopylae/core.declarations';
import { types } from '@thermopylae/lib.utils';
import type { CacheBackend } from '../typings/cache-backend.js';
import type { CacheEntry } from '../typings/commons.js';

/**
 * Backend which uses as underlying storage EcmaScript 6 Map. It can be seen as a simple proxy over
 * Map. Each operation is forwarded to underlying Map instance.
 *
 * @template Key Type of the _key_.
 * @template Value Type of the _value_.
 * @template Entry Type of the cache entry. <br/> Defaults to {@link CacheEntry}.
 */
class EsMapCacheBackend<Key, Value, Entry extends CacheEntry<Key, Value> = CacheEntry<Key, Value>> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, Entry>;

	public constructor() {
		this.store = new Map<Key, Entry>();
	}

	/** @inheritdoc */
	public get(key: Key): Undefinable<Entry> {
		return this.store.get(key);
	}

	/** @inheritdoc */
	public has(key: Key): boolean {
		return this.store.has(key);
	}

	/** @inheritdoc */
	public set(key: Key, value: Value): Entry {
		const entry = { key, value } as Entry;
		this.store.set(key, entry);
		return entry;
	}

	/** @inheritdoc */
	public del(entry: Entry): void {
		entry.value = types.SOFT_DELETE; // let GC collect value
		this.store.delete(entry.key);
		entry.key = types.SOFT_DELETE; // let GC collect value
	}

	/** @inheritdoc */
	public clear(): void {
		return this.store.clear();
	}

	/** @inheritdoc */
	public get size(): number {
		return this.store.size;
	}

	/** @inheritdoc */
	public [Symbol.iterator](): IterableIterator<[Key, Entry]> {
		return this.store[Symbol.iterator]();
	}

	/** @inheritdoc */
	public keys(): IterableIterator<Key> {
		return this.store.keys();
	}

	/** @inheritdoc */
	public values(): IterableIterator<Entry> {
		return this.store.values();
	}
}

export { EsMapCacheBackend };
