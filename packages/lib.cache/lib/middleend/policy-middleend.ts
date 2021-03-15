import { Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheBackend } from '../contracts/cache-backend';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheReplacementPolicy, EntryValidity, SetOperationContext } from '../contracts/replacement-policy';
import { CacheMiddleEnd } from '../contracts/cache-middleend';
import { CacheEntry } from '../contracts/commons';

interface PolicyMiddleEndArgumentsBundle {
	/**
	 * Number of the elements in the cache.
	 */
	totalEntriesNo: number;
}

class PolicyMiddleEnd<Key, Value, ArgumentsBundle extends PolicyMiddleEndArgumentsBundle> implements CacheMiddleEnd<Key, Value, ArgumentsBundle> {
	private readonly backend: CacheBackend<Key, Value>;

	private readonly policies: Array<CacheReplacementPolicy<Key, Value>>;

	constructor(backend: CacheBackend<Key, Value>, policies: Array<CacheReplacementPolicy<Key, Value>>) {
		this.backend = backend;
		this.policies = policies;

		for (const policy of policies) {
			policy.setDeleter(this.del);
		}
	}

	public get(key: Key): Undefinable<Value> {
		const entry = this.internalGet(key); // @fixme to be reviewed
		return entry && entry.value;
	}

	public set(key: Key, value: Value, argsBundle?: ArgumentsBundle): CacheEntry<Value> {
		let entry = this.internalGet(key); // @fixme maybe we should use there raw get
		if (entry === NOT_FOUND_VALUE) {
			entry = this.backend.set(key, value);
			// @fixme add key to entry
			// @fixme add totalEntriesNo to argsBundle, but only after we set to backend, because after this set it might overflow

			let policyIndex = 0;
			try {
				for (; policyIndex < this.policies.length; policyIndex++) {
					this.policies[policyIndex].onSet(key, entry, argsBundle); // @fixme pass args bundle
				}
				return entry;
			} catch (e) {
				// rollback
				for (let i = 0; i < policyIndex; i++) {
					this.policies[policyIndex].onDelete(key, entry);
				}
				this.backend.del(key);

				// re-throw
				throw e;
			}
		}

		// @fixme add totalEntriesNo to argsBundle, before updating item
		entry.value = value;
		for (const policy of this.policies) {
			policy.onUpdate(key, entry, argsBundle); // @fixme pass args bundle
		}

		return entry;

		/**
		 * @fixme another bug
		 * Take care because most policies don't keep metadata in distinct data structures (e.g. Set or Map)
		 * This way if same item is added multiple times, they will contain duplicates in their internal data structures.
		 * This will lead to UNDEFINED BEHAVIOUR.
		 */

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
	}

	// @fixme review what's bellow

	public del = (key: Key): boolean => {
		const entry = this.backend.get(key);
		if (!entry) {
			return false;
		}

		for (const policy of this.policies) {
			policy.onDelete(key, entry);
		}

		return this.backend.del(key);
	};

	public keys(): Array<Key> {
		return Array.from(this.backend.keys());
	}

	public clear(): void {
		this.backend.clear();
		for (const policy of this.policies) {
			policy.onClear();
		}
	}

	public get size(): number {
		return this.backend.size;
	}

	private internalGet(key: Key): Undefinable<CacheEntry<Value>> {
		const entry = this.backend.get(key);

		if (entry === NOT_FOUND_VALUE) {
			for (const policy of this.policies) {
				policy.onMiss(key);
			}

			return entry;
		}

		for (const policy of this.policies) {
			// if policy tries to remove entry (e.g. expired entry, cache full -> evicted entry), other ones will be notified
			if (policy.onHit(key, entry) === EntryValidity.NOT_VALID) {
				return NOT_FOUND_VALUE;
			}
		}

		return entry;
	}
}

export { PolicyMiddleEnd };
