import { Undefinable } from '@thermopylae/core.declarations';
import { CacheBackend } from '../contracts/cache-backend';
import { NOT_FOUND_VALUE } from '../constants';
import { CacheReplacementPolicy, EntryValidity } from '../contracts/cache-replacement-policy';
import { Cache } from '../contracts/cache';
import { CacheEntry } from '../contracts/commons';
import { CacheEventEmitterInterface, CacheEvent } from '../contracts/cache-event-emitter';
import { CacheEventEmitter } from '../helpers/event-emitter';

// @fixme create example file when try to use all policies to test type safety and also interaction
class PolicyBasedCache<Key, Value, ArgumentsBundle> implements Cache<Key, Value, ArgumentsBundle> {
	private readonly backend: CacheBackend<Key, Value>;

	private readonly policies: Array<CacheReplacementPolicy<Key, Value, ArgumentsBundle>>;

	private readonly emitter: CacheEventEmitterInterface<Key, Value>;

	public constructor(backend: CacheBackend<Key, Value>, policies?: Array<CacheReplacementPolicy<Key, Value, ArgumentsBundle>>) {
		this.backend = backend;
		this.policies = policies || [];
		this.emitter = new CacheEventEmitter<Key, Value>();

		for (const policy of this.policies) {
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
	 * therefore even if method returns **true**, trying to *get* item might evict him.
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
			// @fixme prevent multiple eviction by each policy when cache is full by the way that policies get cache latest size (TEST THIS)

			let policyIndex = 0;
			try {
				for (; policyIndex < this.policies.length; policyIndex++) {
					this.policies[policyIndex].onSet(key, entry, argsBundle);
				}

				this.emitter.emit(CacheEvent.INSERT, key, value);
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

		this.emitter.emit(CacheEvent.UPDATE, key, value);
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

		this.emitter.emit(CacheEvent.FLUSH);
	}

	private internalDelete = (key: Key, entry: CacheEntry<Value>): boolean => {
		for (const policy of this.policies) {
			policy.onDelete(key, entry);
		}

		this.backend.del(key);
		this.emitter.emit(CacheEvent.DELETE, key, entry.value);

		return true;
	};
}

export { PolicyBasedCache };
