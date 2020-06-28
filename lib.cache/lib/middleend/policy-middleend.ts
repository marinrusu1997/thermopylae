import { Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheBackend, CacheEntry } from '../contracts/sync/cache-backend';
import { ExpirationPolicy } from '../contracts/sync/expiration-policy';
import { EvictionPolicy } from '../contracts/sync/eviction-policy';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheMiddleEnd, CacheStats } from '../contracts/sync/cache-middleend';

class PolicyMiddleEnd<K, V> implements CacheMiddleEnd<K, V> {
	private readonly backend: CacheBackend<K, V>;

	private readonly expiration: ExpirationPolicy<K, V>;

	private readonly eviction: EvictionPolicy<K, V>;

	protected readonly cacheStats: CacheStats;

	constructor(backend: CacheBackend<K, V>, expiration: ExpirationPolicy<K, V>, eviction: EvictionPolicy<K, V>) {
		this.backend = backend;
		this.expiration = expiration;
		this.eviction = eviction;
		this.cacheStats = {
			hits: 0,
			misses: 0
		};

		this.expiration.setDeleter((key) => this.del(key));
		this.eviction.setDeleter((key) => this.del(key));
	}

	public get(key: K): Undefinable<V> {
		const entry = this.internalGet(key);
		return entry && entry.value;
	}

	public set(key: K, value: V, ttl?: Seconds, expiresFrom?: UnixTimestamp): CacheEntry<V> {
		const entry: CacheEntry<V> = this.backend.set(key, value);

		try {
			this.expiration.onSet(key, entry, ttl!, expiresFrom);
			this.eviction.onSet(key, entry, this.backend.size);
		} catch (e) {
			this.backend.del(key);
			throw e;
		}

		return entry;
	}

	public replace(key: K, value: V, ttl?: Seconds, expiresFrom?: UnixTimestamp): boolean {
		const entry = this.internalGet(key);
		if (entry === NOT_FOUND_VALUE) {
			return false;
		}

		entry.value = value;
		if (ttl != null) {
			this.expiration.onUpdate(key, entry, ttl, expiresFrom);
		}

		return true;
	}

	public ttl(key: K, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean {
		const entry = this.internalGet(key);
		if (entry === NOT_FOUND_VALUE) {
			return false;
		}

		this.expiration.onUpdate(key, entry, ttl, expiresFrom);

		return true;
	}

	public del(key: K): boolean {
		let entry: Undefinable<CacheEntry<V>>;
		const entryRequiredOnDeletion = this.expiration.requiresEntryOnDeletion || this.eviction.requiresEntryOnDeletion;
		if (entryRequiredOnDeletion) {
			entry = this.backend.get(key);

			if (entry === NOT_FOUND_VALUE) {
				return false;
			}
		}

		if (this.backend.del(key)) {
			this.expiration.onDelete(key, entry);
			this.eviction.onDelete(key, entry);

			return true;
		}

		return false;
	}

	public keys(): Array<K> {
		return this.backend.keys();
	}

	public clear(): void {
		this.backend.clear();
		this.expiration.onClear();
		this.eviction.onClear();

		this.cacheStats.misses = 0;
		this.cacheStats.hits = 0;
	}

	public get size(): number {
		return this.backend.size;
	}

	public get stats(): CacheStats {
		return this.cacheStats;
	}

	private internalGet(key: K): Undefinable<CacheEntry<V>> {
		const entry = this.backend.get(key);

		if (entry === NOT_FOUND_VALUE) {
			this.cacheStats.misses += 1;
			return NOT_FOUND_VALUE;
		}

		const removed = this.expiration.removeIfExpired(key, entry!);
		if (removed) {
			return NOT_FOUND_VALUE;
		}

		this.cacheStats.hits += 1;
		this.eviction.onGet(key, entry!);

		return entry;
	}
}

export { PolicyMiddleEnd };
