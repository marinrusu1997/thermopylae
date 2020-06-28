import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend, CacheEntry } from '../../contracts/sync/cache-backend';

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

	public del(key: Key): boolean {
		return this.store.delete(key);
	}

	public clear(): void {
		return this.store.clear();
	}

	public get size(): number {
		return this.store.size;
	}

	public keys(): Array<Key> {
		return Array.from(this.store.keys());
	}
}

export { EsMapBackend };
