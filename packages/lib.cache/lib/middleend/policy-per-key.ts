import { Undefinable } from '@thermopylae/core.declarations';
import { CacheMiddleEnd } from '../contracts/cache-middleend';
import { CacheReplacementPolicy, EntryValidity } from '../contracts/replacement-policy';
import { CacheBackend } from '../contracts/cache-backend';
import { CacheEntry } from '../contracts/commons';
import { NOT_FOUND_VALUE } from '../constants';

const POLICIES_SYM = Symbol('POLICIES_SYM');

interface CacheEntryEvictedBySpecialisedPolicies<Value> extends CacheEntry<Value> {
	[POLICIES_SYM]: Array<string> | IterableIterator<string>;
}

interface PolicyPerKeyCacheMiddleEndArgumentsBundle {
	policies?: Array<string>;
}

class PolicyPerKeyCacheMiddleEnd<Key, Value, ArgumentsBundle extends PolicyPerKeyCacheMiddleEndArgumentsBundle>
	implements CacheMiddleEnd<Key, Value, ArgumentsBundle> {
	private readonly backend: CacheBackend<Key, Value>;

	private readonly policies: Map<string, CacheReplacementPolicy<Key, Value, ArgumentsBundle>>;

	public constructor(backend: CacheBackend<Key, Value>, policies: Map<string, CacheReplacementPolicy<Key, Value, ArgumentsBundle>>) {
		this.backend = backend;
		this.policies = policies;

		for (const policy of this.policies.values()) {
			policy.setDeleter(this.internalDelete);
		}
	}

	public get size(): number {
		return this.backend.size;
	}

	public get(key: Key): Undefinable<Value> {
		const entry = this.backend.get(key) as CacheEntryEvictedBySpecialisedPolicies<Value>;

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
		let entry = this.backend.get(key) as CacheEntryEvictedBySpecialisedPolicies<Value>;

		if (entry === NOT_FOUND_VALUE) {
			entry = this.backend.set(key, value) as CacheEntryEvictedBySpecialisedPolicies<Value>;
			entry[POLICIES_SYM] = argsBundle && argsBundle.policies ? argsBundle.policies : this.policies.keys();

			// @fixme take care so that no one throws
			for (const policyName of entry[POLICIES_SYM]) {
				this.policies.get(policyName)!.onSet(key, entry, argsBundle);
			}

			return;
		}

		entry.value = value;

		for (const policyName of entry[POLICIES_SYM]) {
			this.policies.get(policyName)!.onUpdate(key, entry, argsBundle);
		}
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
	}

	public keys(): Array<Key> {
		return Array.from(this.backend.keys());
	}

	private internalDelete = (key: Key, entry: CacheEntry<Value>) => {
		for (const policyName of (entry as CacheEntryEvictedBySpecialisedPolicies<Value>)[POLICIES_SYM]) {
			this.policies.get(policyName)!.onDelete(key, entry);
		}

		return this.backend.del(key);
	};
}

export { PolicyPerKeyCacheMiddleEnd, PolicyPerKeyCacheMiddleEndArgumentsBundle };
