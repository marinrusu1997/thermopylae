import { Undefinable } from '@thermopylae/core.declarations';
import { Cache } from '../contracts/cache';
import { CacheReplacementPolicy, EntryValidity } from '../contracts/cache-replacement-policy';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheEventEmitterInterface, CacheEvent } from '../contracts/cache-event-emitter';
import { CacheEventEmitter } from '../helpers/event-emitter';

const POLICIES_SYM = Symbol('POLICIES_SYM');

interface CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag> extends CacheEntry<Value> {
	[POLICIES_SYM]: ReadonlyArray<PolicyTag>;
}

interface PolicyPerKeyCacheArgumentsBundle<PolicyTag> {
	policies?: ReadonlyArray<PolicyTag>;
}

class PolicyPerKeyCache<
	Key,
	Value,
	PolicyTag = string,
	ArgumentsBundle extends PolicyPerKeyCacheArgumentsBundle<PolicyTag> = PolicyPerKeyCacheArgumentsBundle<PolicyTag>
> implements Cache<Key, Value, ArgumentsBundle> {
	/**
	 * @private
	 */
	private readonly backend: CacheBackend<Key, Value>;

	private readonly policies: ReadonlyMap<PolicyTag, CacheReplacementPolicy<Key, Value, ArgumentsBundle>>;

	private readonly emitter: CacheEventEmitterInterface<Key, Value>;

	private readonly allPoliciesTags: ReadonlyArray<PolicyTag>;

	public constructor(backend: CacheBackend<Key, Value>, policies: ReadonlyMap<PolicyTag, CacheReplacementPolicy<Key, Value, ArgumentsBundle>>) {
		this.backend = backend;
		this.policies = policies;
		this.emitter = new CacheEventEmitter<Key, Value>();
		this.allPoliciesTags = Array.from(this.policies.keys());

		for (const policy of this.policies.values()) {
			policy.setDeleter(this.internalDelete);
		}
	}

	public get size(): number {
		return this.backend.size;
	}

	public get events(): CacheEventEmitterInterface<Key, Value> {
		return this.emitter;
	}

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

	public set(key: Key, value: Value, argsBundle?: ArgumentsBundle): void {
		let entry = this.backend.get(key) as CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag>;

		if (entry === NOT_FOUND_VALUE) {
			entry = this.backend.set(key, value) as CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag>;
			entry[POLICIES_SYM] = argsBundle && argsBundle.policies ? argsBundle.policies : this.allPoliciesTags;

			for (const policyName of entry[POLICIES_SYM]) {
				this.policies.get(policyName)!.onSet(key, entry, argsBundle);
			}

			this.emitter.emit(CacheEvent.INSERT, key, value);
			return;
		}

		entry.value = value;
		for (const policyName of entry[POLICIES_SYM]) {
			this.policies.get(policyName)!.onUpdate(key, entry, argsBundle);
		}

		this.emitter.emit(CacheEvent.UPDATE, key, value);
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

	public del(key: Key): boolean {
		const entry = this.backend.get(key);
		if (!entry) {
			return false;
		}

		return this.internalDelete(key, entry);
	}

	public clear(): void {
		for (const policy of this.policies.values()) {
			policy.onClear();
		}
		this.backend.clear();

		this.emitter.emit(CacheEvent.FLUSH);
	}

	public keys(): Array<Key> {
		return Array.from(this.backend.keys());
	}

	private internalDelete = (key: Key, entry: CacheEntry<Value>): boolean => {
		for (const policyName of (entry as CacheEntryEvictedBySpecialisedPolicies<Value, PolicyTag>)[POLICIES_SYM]) {
			this.policies.get(policyName)!.onDelete(key, entry);
		}

		this.backend.del(key);
		this.emitter.emit(CacheEvent.DELETE, key, entry.value);

		return true;
	};
}

export { PolicyPerKeyCache, PolicyPerKeyCacheArgumentsBundle, CacheEntryEvictedBySpecialisedPolicies };
