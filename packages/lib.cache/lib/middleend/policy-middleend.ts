import { Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheBackend } from '../contracts/cache-backend';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheReplacementPolicy, EntryValidity, SetOperationContext } from '../contracts/replacement-policy';
import { CacheMiddleEnd } from '../contracts/cache-middleend';
import { CacheStats, CacheEntry } from '../contracts/commons';

class PolicyMiddleEnd<K, V> implements CacheMiddleEnd<K, V> {
	private readonly backend: CacheBackend<K, V>;

	private readonly policies: Array<CacheReplacementPolicy<K, V>>;

	protected readonly cacheStats: CacheStats;

	constructor(backend: CacheBackend<K, V>, policies: Array<CacheReplacementPolicy<K, V>>) {
		this.backend = backend;
		this.policies = policies;
		this.cacheStats = {
			hits: 0,
			misses: 0
		};

		for (const policy of policies) {
			policy.setDeleter(this.del);
		}
	}

	public get(key: K): Undefinable<V> {
		const entry = this.internalGet(key);
		return entry && entry.value;
	}

	public set(key: K, value: V, ttl: Seconds, expiresFrom?: UnixTimestamp): CacheEntry<V> {
		const entry: CacheEntry<V> = this.backend.set(key, value);

		try {
			const context = PolicyMiddleEnd.buildSetContext(this.backend.size, ttl, expiresFrom);
			for (const policy of this.policies) {
				policy.onSet(key, entry, context);
			}
		} catch (e) {
			this.backend.del(key, false);
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
		const context = PolicyMiddleEnd.buildSetContext(this.backend.size, ttl, expiresFrom);
		for (const policy of this.policies) {
			policy.onUpdate(key, entry, context);
		}

		return true;
	}

	public ttl(key: K, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean {
		const entry = this.internalGet(key);
		if (entry === NOT_FOUND_VALUE) {
			return false;
		}

		const context = PolicyMiddleEnd.buildSetContext(this.backend.size, ttl, expiresFrom);
		for (const policy of this.policies) {
			policy.onUpdate(key, entry, context);
		}

		return true;
	}

	public del(key: K): boolean {
		let entryRequiredOnDeletion = false;
		for (const policy of this.policies) {
			if ((entryRequiredOnDeletion = policy.requiresEntryOnDeletion)) {
				break;
			}
		}

		const entry = this.backend.del(key, entryRequiredOnDeletion);

		if (entry) {
			for (const policy of this.policies) {
				policy.onDelete(key, entry as CacheEntry<V>);
			}
			return true;
		}

		return false;
	}

	public keys(): Array<K> {
		return Array.from(this.backend.keys());
	}

	public clear(): void {
		this.backend.clear();
		for (const policy of this.policies) {
			policy.onClear();
		}

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
			for (const policy of this.policies) {
				policy.onMiss(key);
			}

			return NOT_FOUND_VALUE;
		}

		for (const policy of this.policies) {
			// if policy tries to remove entry (e.g. expired entry, cache full -> evicted entry), other ones will be notified
			if (policy.onHit(key, entry) === EntryValidity.NOT_VALID) {
				return NOT_FOUND_VALUE;
			}
		}

		this.cacheStats.hits += 1;

		return entry;
	}

	private static buildSetContext(elements: number, expiresAfter?: Seconds, expiresFrom?: UnixTimestamp): SetOperationContext {
		return { totalEntriesNo: elements, expiresAfter, expiresFrom };
	}
}

export { PolicyMiddleEnd };
