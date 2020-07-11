import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend } from '../../contracts/sync/cache-backend';
import CacheEntry from '../../contracts/commons';

class EsMapBackend<Key, Value> implements CacheBackend<Key, Value> {
	private readonly store: Map<Key, CacheEntry<Value>>;

	constructor() {
		this.store = new Map<Key, CacheEntry<Value>>();
	}

	public get(key: Key): Undefinable<CacheEntry<Value>> {
		return this.store.get(key);
	}

	public set(key: Key, value: Value): CacheEntry<Value> {
		const entry: CacheEntry<Value> = { value };
		this.store.set(key, entry);
		return entry;
	}

	public keys(): IterableIterator<Key> {
		return this.store.keys();
	}

	public del(key: Key, withEntry: boolean): boolean | Undefinable<CacheEntry<Value>> {
		if (withEntry) {
			const entry = this.store.get(key);
			this.store.delete(key);
			return entry;
		}
		return this.store.delete(key);
	}

	public clear(): void {
		return this.store.clear();
	}

	public get size(): number {
		return this.store.size;
	}

	[Symbol.iterator](): IterableIterator<[Key, CacheEntry<Value>]> {
		return this.store[Symbol.iterator]();
	}
}

export { EsMapBackend };
