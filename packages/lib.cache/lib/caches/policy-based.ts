import { Undefinable } from '@thermopylae/core.declarations';
import { EventEmitter } from 'events';
import { CacheBackend } from '../contracts/cache-backend';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheReplacementPolicy, EntryValidity } from '../contracts/cache-replacement-policy';
import { Cache, CacheEvent } from '../contracts/cache';
import { CacheEntry } from '../contracts/commons';

// @fixme create example file when try to use all policies to test type safety and also interaction

/**
 * {@link Cache} implementation which uses {@link CacheReplacementPolicy} for keys eviction. <br/>
 * Although any predefined policy can be used, there are some restrictions for multiple policies combination:
 *
 * 	- you can use a single type of expiration policies, choices are:
 * 		- {@link ProactiveExpirationPolicy}
 * 		- {@link ReactiveExpirationPolicy}
 * 		- {@link SlidingProactiveExpirationPolicy}
 *	- you can use a single type of LRU & LFU implementations, choices are:
 * 		- {@link LRUEvictionPolicy}
 * 		- {@link SegmentedLRUPolicy}
 *		- {@link LFUEvictionPolicy}
 * 		- {@link LFUDAEvictionPolicy}
 * 		- {@link GDSFEvictionPolicy}
 *	- you can use {@link PriorityEvictionPolicy}
 * 	- you can use {@link EntryDependenciesEvictionPolicy}
 *
 * Therefore, it results that you use maximum 4 different cache entry replacement policies.
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
			return entry;
		}

		for (const policy of this.policies) {
			// if policy tries to remove entry (e.g. expired entry, cache full -> evicted entry), other ones will be notified
			if (policy.onGet(key, entry) === EntryValidity.NOT_VALID) {
				// it's safe to break the cycle here, because in case an item is evicted, onDelete hook for each policy will be triggered automatically
				return NOT_FOUND_VALUE;
			}
		}

		return entry.value;
	}

	/**
	 * Check whether **key** is present in the cache, without calling policies *onGet* hook. <br/>
	 * Notice, that some policies might evict item when *onGet* hook is called (e.g. item expired),
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
		// we use raw get, so that we don't call `onGet` and also even if they will remove it within `onGet`,
		// we will add it back anyway, so better use `onUpdate` which will update policies meta-data while keeping entry in the cache
		let entry = this.backend.get(key);

		if (entry === NOT_FOUND_VALUE) {
			entry = this.backend.set(key, value);
			// @fixme add key to entry
			// @fixme prevent multiple eviction by each policy when cache is full by the way that policies get cache latest size (TEST THIS)

			let policyIndex = 0;
			try {
				for (; policyIndex < this.policies.length; policyIndex++) {
					this.policies[policyIndex].onSet(key, entry, argsBundle);
				}

				this.emit(CacheEvent.INSERT, key, value);
				return;
			} catch (e) {
				// rollback
				for (let i = 0; i < policyIndex; i++) {
					this.policies[i].onDelete(key, entry); // detach metadata + internal structures
				}
				this.backend.del(key);

				// re-throw
				throw e;
			}
		}

		entry.value = value;
		for (const policy of this.policies) {
			policy.onUpdate(key, entry, argsBundle);
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

		return this.internalDelete(key, entry);
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

	private internalDelete = (key: Key, entry: CacheEntry<Value>): boolean => {
		for (const policy of this.policies) {
			policy.onDelete(key, entry);
		}

		this.backend.del(key);
		this.emit(CacheEvent.DELETE, key, entry.value);

		return true;
	};
}

export { PolicyBasedCache };
