import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend, CacheEntry } from '../../contracts/sync/cache-backend';

class PoolBackend<K, V> implements CacheBackend<K, V> {
	private readonly store: Map<K, CacheEntry<V>>;

	constructor() {
		this.store = new Map<K, CacheEntry<V>>();
	}

	public get(key: K): Undefinable<CacheEntry<V>> {}

	set(key: K, value: V): CacheEntry<V> {
		return undefined;
	}

	del(key: K): boolean {
		return false;
	}

	keys(): Array<K> {
		return undefined;
	}

	clear(): void {}

	public get size(): number {}
}
