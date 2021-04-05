import { Undefinable } from '@thermopylae/core.declarations';
import { EventEmitter } from 'events';
import { Cache, CacheEvent } from '../contracts/cache';
import { CacheReplacementPolicy, EntryValidity } from '../contracts/cache-replacement-policy';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';
import { NOT_FOUND_VALUE } from '../constants';

/**
 * @internal
 */
const POLICIES_SYM = Symbol('POLICIES_SYM');

/**
 * @internal
 */
interface CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag> extends CacheEntry<Value> {
	[POLICIES_SYM]: ReadonlyArray<PolicyTag>;
}

interface PolicyPerKeyCacheArgumentsBundle<PolicyTag> {
	/**
	 * Array of policies used for a particular key. <br/>
	 * If not given, key will be tracked by all of the available policies.
	 */
	policies?: ReadonlyArray<PolicyTag>;
}

/**
 * {@link Cache} implementation which uses {@link CacheReplacementPolicy} for keys eviction. <br/>
 * It can selectively use different policies for a particular key.
 * In order to do so, each policy is tagged for further identification.
 * When client inserts a new key, it can specify a list of policy tags which will track that key.
 * If it doesn't specify any tags, key will be tracked by all of the available policies. <br/>
 * Although any predefined policy can be used, there are some restrictions for multiple policies combination. <br/>
 * You can combine only 1 policy from each category in the {@link PolicyPerKeyCacheArgumentsBundle.policies}:
 *
 * Category			|	Policies
 * ---------------- | -----------------------------
 * Expiration		| - {@link ProactiveExpirationPolicy}<br/>- {@link ReactiveExpirationPolicy}<br/>- {@link SlidingProactiveExpirationPolicy}
 * LRU & LFU		| - {@link LRUEvictionPolicy}<br/>- {@link SegmentedLRUEvictionPolicy}<br/>- {@link LFUEvictionPolicy}<br/>- {@link LFUDAEvictionPolicy}<br/>- {@link GDSFEvictionPolicy}
 * Priority			| - {@link PriorityEvictionPolicy}
 * Dependencies		| - {@link KeysDependenciesEvictionPolicy}
 *
 * For example, the following combination is a valid one: [{@link ProactiveExpirationPolicy}, {@link LRUEvictionPolicy}, {@link KeysDependenciesEvictionPolicy}].<br/>
 * While the following: [{@link ProactiveExpirationPolicy}, {@link SlidingProactiveExpirationPolicy}] isn't, because it contains 2 policies from same category.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template PolicyTag			Type of the policy tag.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class PolicyPerKeyCache<
		Key,
		Value,
		PolicyTag = string,
		ArgumentsBundle extends PolicyPerKeyCacheArgumentsBundle<PolicyTag> = PolicyPerKeyCacheArgumentsBundle<PolicyTag>
	>
	extends EventEmitter
	implements Cache<Key, Value, ArgumentsBundle> {
	/**
	 * @private
	 */
	private readonly backend: CacheBackend<Key, Value>;

	private readonly policies: ReadonlyMap<PolicyTag, CacheReplacementPolicy<Key, Value, ArgumentsBundle>>;

	private readonly allPoliciesTags: ReadonlyArray<PolicyTag>;

	/**
	 * @param backend		Cache backend.
	 * @param policies		Tagged cache replacement policies.
	 */
	public constructor(backend: CacheBackend<Key, Value>, policies: ReadonlyMap<PolicyTag, CacheReplacementPolicy<Key, Value, ArgumentsBundle>>) {
		super();

		this.backend = backend;
		this.policies = policies;
		this.allPoliciesTags = Array.from(this.policies.keys());

		for (const policy of this.policies.values()) {
			policy.setDeleter(this.internalDelete);
		}
	}

	/**
	 * @inheritDoc
	 */
	public get size(): number {
		return this.backend.size;
	}

	/**
	 * @inheritDoc
	 */
	public get(key: Key): Undefinable<Value> {
		const entry = this.backend.get(key) as CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag>;

		if (entry === NOT_FOUND_VALUE) {
			return entry;
		}

		for (const policyName of entry[POLICIES_SYM]) {
			if (this.policies.get(policyName)!.onGet(key, entry) === EntryValidity.NOT_VALID) {
				return NOT_FOUND_VALUE;
			}
		}

		return entry.value;
	}

	/**
	 * @inheritDoc
	 */
	public set(key: Key, value: Value, argsBundle?: ArgumentsBundle): void {
		let entry = this.backend.get(key) as CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag>;

		if (entry === NOT_FOUND_VALUE) {
			entry = this.backend.set(key, value) as CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag>;
			entry[POLICIES_SYM] = argsBundle && argsBundle.policies ? argsBundle.policies : this.allPoliciesTags;

			for (const policyName of entry[POLICIES_SYM]) {
				this.policies.get(policyName)!.onSet(key, entry, argsBundle);
			}

			this.emit(CacheEvent.INSERT, key, value);
			return;
		}

		entry.value = value;
		for (const policyName of entry[POLICIES_SYM]) {
			this.policies.get(policyName)!.onUpdate(key, entry, argsBundle);
		}

		this.emit(CacheEvent.UPDATE, key, value);
	}

	/**
	 * Check whether **key** is present in the cache, without calling policies *onGet* hook. <br/>
	 * Notice, that some policies might evict item when *onGet* hook is called (e.g. item expired),
	 * therefore even if method returns **true**, trying to *get* item might evict him.
	 *
	 * @param key	Name of the key.
	 */
	public has(key: Key): boolean {
		return this.backend.has(key);
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
	public clear(): void {
		for (const policy of this.policies.values()) {
			policy.onClear();
		}
		this.backend.clear();

		this.emit(CacheEvent.FLUSH);
	}

	/**
	 * @inheritDoc
	 */
	public keys(): Array<Key> {
		return Array.from(this.backend.keys());
	}

	private internalDelete = (key: Key, entry: CacheEntry<Value>): boolean => {
		for (const policyName of (entry as CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag>)[POLICIES_SYM]) {
			this.policies.get(policyName)!.onDelete(key, entry);
		}

		this.backend.del(key);
		this.emit(CacheEvent.DELETE, key, entry.value);

		return true;
	};
}

export { PolicyPerKeyCache, PolicyPerKeyCacheArgumentsBundle, CacheEntryEvictedBySpecialisedPolicies };
