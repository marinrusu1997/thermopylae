import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend } from '../contracts/cache-backend';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheReplacementPolicy, EntryValidity } from '../contracts/replacement-policy';
import { CacheMiddleEnd } from '../contracts/cache-middleend';
import { CacheEntry } from '../contracts/commons';

class PolicyBasedCacheMiddleEnd<Key, Value, ArgumentsBundle> implements CacheMiddleEnd<Key, Value, ArgumentsBundle> {
	private readonly backend: CacheBackend<Key, Value>;

	private readonly policies: Array<CacheReplacementPolicy<Key, Value, ArgumentsBundle>>;

	constructor(backend: CacheBackend<Key, Value>, policies?: Array<CacheReplacementPolicy<Key, Value, ArgumentsBundle>>) {
		this.backend = backend;
		this.policies = policies || [];

		for (const policy of this.policies) {
			policy.setDeleter(this.internalDelete);
		}
	}

	public get(key: Key): Undefinable<Value> {
		const entry = this.backend.get(key);

		if (entry === NOT_FOUND_VALUE) {
			return entry;
		}

		for (const policy of this.policies) {
			// if policy tries to remove entry (e.g. expired entry, cache full -> evicted entry), other ones will be notified
			if (policy.onGet(key, entry) === EntryValidity.NOT_VALID) {
				// @fixme test this behaviour with reactive expiration policy, and the one described in bellow comment
				// it's safe to break the cycle here, because in case an item is evicted, onDelete hook for each policy will be triggered automatically
				return NOT_FOUND_VALUE;
			}
		}

		return entry.value;
	}

	/**
	 * Check whether **key** is present in the cache, without calling policies *onGet* hook. <br/>
	 * Notice, that some policies might evict item when *onGet* hook is called (e.g. item expired),
	 * therefore even if method returns **true**, trying to *get* item will evict him.
	 *
	 * @param key	Name of the key.
	 */
	public has(key: Key): boolean {
		return this.backend.has(key);
	}

	public set(key: Key, value: Value, argsBundle?: ArgumentsBundle): void {
		// we use raw get, so that we don't call `onGet` and also even if they will remove it within `onGet`,
		// we will add it back anyway, so better use `onUpdate` which will update policies meta-data while keeping entry in the cache
		let entry = this.backend.get(key);

		if (entry === NOT_FOUND_VALUE) {
			entry = this.backend.set(key, value);
			// @fixme add key to entry
			// @fixme make sure eviction policies use strict >, because we need to check for overflow, as example take capacity 1
			// @fixme also take care that eviction policies have a dedicated setter for backend size
			// @fixme prevent multiple eviction by each policy when cache is full by the way that policies get cache latest size (TEST THIS)

			let policyIndex = 0;
			try {
				for (; policyIndex < this.policies.length; policyIndex++) {
					this.policies[policyIndex].onSet(key, entry, argsBundle);
				}
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
			policy.onUpdate(key, entry, argsBundle); // @fixme should not throw
		}
	}

	public del(key: Key): boolean {
		const entry = this.backend.get(key);
		if (!entry) {
			return false;
		}

		return this.internalDelete(key, entry);
	}

	public keys(): Array<Key> {
		return Array.from(this.backend.keys());
	}

	public clear(): void {
		for (const policy of this.policies) {
			policy.onClear();
		}
		this.backend.clear();
	}

	public get size(): number {
		return this.backend.size;
	}

	private internalDelete = (key: Key, entry: CacheEntry<Value>) => {
		for (const policy of this.policies) {
			policy.onDelete(key, entry); // @fixme should not throw
		}

		return this.backend.del(key);
	};
}

export { PolicyBasedCacheMiddleEnd };
