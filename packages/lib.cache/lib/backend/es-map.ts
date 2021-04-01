import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';

class EsMapBackend<Key, Value, Entry extends CacheEntry<Value> = CacheEntry<Value>> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, Entry>;

	constructor() {
		this.store = new Map<Key, Entry>();
	}

	public get(key: Key): Undefinable<Entry> {
		return this.store.get(key);
	}

	public has(key: Key): boolean {
		return this.store.has(key);
	}

	public set(key: Key, value: Value): Entry {
		const entry = { value } as Entry;
		this.store.set(key, entry);
		return entry;
	}

	public del(key: Key): boolean {
		return this.store.delete(key);
	}

	public clear(): void {
		return this.store.clear();
	}

	public get size(): number {
		return this.store.size;
	}

	public [Symbol.iterator](): IterableIterator<[Key, Entry]> {
		return this.store[Symbol.iterator]();
	}

	public keys(): IterableIterator<Key> {
		return this.store.keys();
	}

	public values(): IterableIterator<Entry> {
		return this.store.values();
	}
}

export { EsMapBackend };
