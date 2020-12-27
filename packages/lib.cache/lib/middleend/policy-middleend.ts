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
			// @fixme to be moved into frontend
			hits: 0,
			misses: 0
		};

		for (const policy of policies) {
			/**
			 * @fixme here we need to create deleter for each one, so that we knew which one evicted key, and not to call onDelete for him
			 */
			policy.setDeleter(this.del);
		}
	}

	public get(key: K): Undefinable<V> {
		const entry = this.internalGet(key);
		return entry && entry.value;
	}

	public set(key: K, value: V, ttl: Seconds, expiresFrom?: UnixTimestamp): CacheEntry<V> {
		/**
		 * @fixme another bug
		 * Take care because most policies don't keep metadata in distinct data structures (e.g. Set or Map)
		 * This way if same item is added multiple times, they will contain duplicates in their internal data structures.
		 * This will lead to UNDEFINED BEHAVIOUR.
		 */

		const entry: CacheEntry<V> = this.backend.set(key, value);

		try {
			/**
			 * @fixme huge bug problem
			 * Context needs to be global for this middleend and injected via setter in each policy.
			 * On each CRUD operation, context needs to be updated.
			 * This haves the following benefits:
			 * 		- we don't create new object on each set
			 * 		- no need to bloat policy API (it can use context as it wants in each of it's ops)
			 * 		- prevent multiple eviction by each policy when cache is full
			 * 			(because context is build once and not updated with latest cache capacity, each policy will think that he must evict an item)
			 * 			(also take care about sharing of other context properties by each policy)
			 * Context type should be a templated parameter extending default type, so that if other devs create their own policy
			 * and need some custom params, they can templatize midleend and also that policy (this adds third template to policies)
			 */
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
			/**
			 * @fixme take into account that onUpdate might be a hard to do operation, so optimize this scenario (see ProactiveExpirationPolicy)
			 */
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
