import { MaybePromise, Undefinable } from '@thermopylae/core.declarations';
import { EventEmitter } from 'events';
import { CacheBackend } from '../contracts/cache-backend';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../contracts/cache-replacement-policy';
import { Cache, CacheEvent, CacheEventListener } from '../contracts/cache';

// @fixme maybe arguments bundle should use symbols

/**
 * {@link Cache} implementation which uses {@link CacheReplacementPolicy} for keys eviction. <br/>
 * Although any predefined policy can be used, there are some restrictions for multiple policies combination. <br/>
 * You can combine only 1 policy from each category:
 *
 * Category			|	Policies
 * ---------------- | -----------------------------
 * Expiration		| - {@link ProactiveExpirationPolicy}<br/>- {@link ReactiveExpirationPolicy}<br/>- {@link SlidingProactiveExpirationPolicy}<br/>- {@link SlidingReactiveExpirationPolicy}
 * Eviction			| - {@link ArcEvictionPolicy}<br/>- {@link LRUEvictionPolicy}<br/>- {@link SegmentedLRUEvictionPolicy}<br/>- {@link LFUEvictionPolicy}<br/>- {@link LFUDAEvictionPolicy}<br/>- {@link GDSFEvictionPolicy}
 * Priority			| - {@link PriorityEvictionPolicy}
 * Dependencies		| - {@link KeysDependenciesEvictionPolicy}
 *
 * For example, the following combination is a valid one: [{@link ProactiveExpirationPolicy}, {@link LRUEvictionPolicy}, {@link KeysDependenciesEvictionPolicy}].<br/>
 * While the following: [{@link ProactiveExpirationPolicy}, {@link SlidingProactiveExpirationPolicy}] isn't, because it contains 2 policies from same category.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class PolicyBasedCache<Key, Value, ArgumentsBundle = unknown> extends EventEmitter implements Cache<Key, Value, ArgumentsBundle> {
	private readonly backend: CacheBackend<Key, Value>;

	private readonly policies: Array<CacheReplacementPolicy<Key, Value, ArgumentsBundle>>;

	/**
	 * @param backend		Cache backend.
	 * @param policies		Array of policies. <br/>
	 * 						If you pass nothing or an empty array, cache will act as a simple wrapper over backend.
	 */
	public constructor(backend: CacheBackend<Key, Value>, policies?: Array<CacheReplacementPolicy<Key, Value, ArgumentsBundle>>) {
		super();

		this.backend = backend;
		this.policies = policies || [];

		for (const policy of this.policies) {
			policy.setDeleter(this.internalDelete);
		}
	}

	/**
	 * Get number of cache entries.
	 */
	public get size(): number {
		return this.backend.size;
	}

	/**
	 * @inheritDoc
	 */
	public get(key: Key): Undefinable<Value> {
		const entry = this.backend.get(key);

		if (entry === NOT_FOUND_VALUE) {
			for (const policy of this.policies) {
				policy.onMiss(key);
			}
			return entry;
		}

		for (const policy of this.policies) {
			// if policy tries to remove entry (e.g. expired entry, cache full -> evicted entry), other ones will be notified
			if (policy.onHit(entry) === EntryValidity.NOT_VALID) {
				// it's safe to break the cycle here, because in case an item is evicted, onDelete hook for each policy will be triggered automatically
				return NOT_FOUND_VALUE;
			}
		}

		return entry.value;
	}

	/**
	 * Check whether **key** is present in the cache, without calling policies *onHit* hook. <br/>
	 * Notice, that some policies might evict item when *onHit* hook is called (e.g. item expired),
	 * therefore even if method returns **true**, trying to *get* item might evict him and you will get `undefined` as result.
	 *
	 * @param key	Name of the key.
	 */
	public has(key: Key): boolean {
		return this.backend.has(key);
	}

	/**
	 * @inheritDoc
	 */
	public set(key: Key, value: Value, argsBundle?: ArgumentsBundle): void {
		// we use raw get, so that we don't call `onHit` and also even if they will remove it within `onHit`,
		// we will add it back anyway, so better use `onUpdate` which will update policies meta-data while keeping entry in the cache
		let entry = this.backend.get(key);

		if (entry === NOT_FOUND_VALUE) {
			entry = this.backend.set(key, value);

			let policyIndex = 0;
			try {
				for (; policyIndex < this.policies.length; policyIndex++) {
					this.policies[policyIndex].onSet(entry, argsBundle);
				}

				this.emit(CacheEvent.INSERT, key, value);
				return;
			} catch (e) {
				// rollback
				for (let i = 0; i < policyIndex; i++) {
					this.policies[i].onDelete(entry); // detach metadata + internal structures
				}
				this.backend.del(entry);

				// re-throw
				throw e;
			}
		}

		entry.value = value;
		for (const policy of this.policies) {
			policy.onUpdate(entry, argsBundle);
		}

		this.emit(CacheEvent.UPDATE, key, value);
	}

	/**
	 * @inheritDoc
	 */
	public del(key: Key): boolean {
		const entry = this.backend.get(key);
		if (!entry) {
			return false;
		}

		this.internalDelete(entry);
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public keys(): Array<Key> {
		return Array.from(this.backend.keys());
	}

	/**
	 * @inheritDoc
	 */
	public clear(): void {
		for (const policy of this.policies) {
			policy.onClear();
		}
		this.backend.clear();

		this.emit(CacheEvent.FLUSH);
	}

	/**
	 * @inheritDoc
	 */
	public on(event: CacheEvent, listener: CacheEventListener<Key, MaybePromise<Value, 'plain'>>): this {
		return super.on(event, listener);
	}

	private internalDelete: Deleter<Key, Value> = (entry) => {
		for (const policy of this.policies) {
			policy.onDelete(entry);
		}

		this.emit(CacheEvent.DELETE, entry.key, entry.value);
		this.backend.del(entry);
	};
}

export { PolicyBasedCache };
