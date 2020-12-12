import { Undefinable } from '@thermopylae/core.declarations';
import { CacheMiddleEnd } from '../contracts/cache-middleend';
import { CacheBackend } from '../contracts/cache-backend';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheStats } from '../contracts/commons';

class OpaqueMiddleEnd<Key, Value> implements CacheMiddleEnd<Key, Value> {
	private readonly cacheStats: CacheStats;

	private readonly backend: CacheBackend<Key, Value>;

	constructor(backend: CacheBackend<Key, Value>) {
		this.backend = backend;
		this.cacheStats = {
			hits: 0,
			misses: 0
		};
	}

	public get(key: Key): Undefinable<Value> {
		const entry = this.backend.get(key);
		if (entry) {
			this.cacheStats.hits += 1;
			return entry.value;
		}
		this.cacheStats.misses += 1;
		return NOT_FOUND_VALUE;
	}

	public set(key: Key, value: Value): void {
		this.backend.set(key, value);
	}

	public replace(key: Key, value: Value): boolean {
		this.backend.set(key, value);
		return true;
	}

	public ttl(): boolean {
		return false;
	}

	public keys(): Array<Key> {
		return Array.from(this.backend.keys());
	}

	public del(key: Key): boolean {
		return this.backend.del(key, false) as boolean;
	}

	public clear(): void {
		this.backend.clear();
		this.cacheStats.misses = 0;
		this.cacheStats.hits = 0;
	}

	public get stats(): CacheStats {
		return this.cacheStats;
	}

	public get size(): number {
		return this.backend.size;
	}
}

export { OpaqueMiddleEnd };
