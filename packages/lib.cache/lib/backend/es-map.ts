import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';

class EsMapBackend<Key, Value> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, CacheEntry<Value>>;

	constructor() {
		this.store = new Map<Key, CacheEntry<Value>>();
	}

	public get(key: Key): Undefinable<CacheEntry<Value>> {
		return this.store.get(key);
	}

	public has(key: Key): boolean {
		return this.store.has(key);
	}

	public set(key: Key, value: Value): CacheEntry<Value> {
		const entry: CacheEntry<Value> = { value };
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

	public [Symbol.iterator](): IterableIterator<[Key, CacheEntry<Value>]> {
		return this.store[Symbol.iterator]();
	}

	public keys(): IterableIterator<Key> {
		return this.store.keys();
	}

	public values(): IterableIterator<CacheEntry<Value>> {
		return this.store.values();
	}
}

export { EsMapBackend };
