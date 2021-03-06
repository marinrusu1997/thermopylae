import { CacheEntry } from './commons';

// @fixme take care for policies that share symbols on entry which comes from data structures

/**
 * Function, that given a `key`, will remove it from storage. <br/>
 * Deleter makes policy able to delete entries on his own, when it detects that they should no longer be kept. <br/>
 * **Deleter is responsible to call `onDelete` hook for each policy, so that they can clear metadata and internal data structures.**
 *
 * @param key		Name of the key.
 * @param entry		Entry associated with `key`.
 */
declare type Deleter<Key, Value> = (entry: CacheEntry<Key, Value>) => void;

/**
 * Indicates whether {@link CacheEntry} is still valid.
 */
declare const enum EntryValidity {
	NOT_VALID,
	VALID
}

/**
 * Represents an abstraction over {@link CacheEntry} processing. <br/>
 * Policy might intercept cache operations and execute different actions using metadata attached to {@link CacheEntry}.
 * These actions might result in {@link CacheEntry} evictions, depending on policy replacement algorithm.
 *
 * @template Key 				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle received by different operations. <br/>
 * 								This template argument is used to uniformize API of different policy implementations. <br/>
 * 								When using multiple policies together, they will share a common arguments bundle object.
 */
declare interface CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * Hook executed **after** `entry` for `key` was retrieved. <br/>
	 * Policy might decide that entry is no longer valid and return {@link EntryValidity.NOT_VALID}.
	 * **In case it does so, policy is responsible to evict `entry` from cache before this method returns.**
	 *
	 * @param entry		Entry hit on which was made.
	 *
	 * @returns			Whether entry is still valid.
	 */
	onHit(entry: CacheEntry<Key, Value>): EntryValidity;

	/**
	 * Hook executed **after** `key` wasn't found in the cache on {@link Cache.get} operation.
	 *
	 * @param key		Name of the key.
	 */
	onMiss(key: Key): void;

	/**
	 * Hook executed **after** `entry` for `key` has been set.
	 *
	 * @param entry			Entry that was inserted.
	 * @param argsBundle	Arguments bundle for cache `set` operation.
	 */
	onSet(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void;

	/**
	 * Hook executed **after** value for `entry` associated with `key` has been updated.
	 *
	 * @param entry			Entry that was update.
	 * @param argsBundle	Arguments bundle for cache `set` operation.
	 */
	onUpdate(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void;

	/**
	 * Hook executed **before** `entry` for `key` has been deleted. <br/>
	 * **Policy is supposed to detach metadata from entry
	 * and cleanup it's internal data structures when this hook is called.**
	 *
	 * @param entry		Entry that's being deleted.
	 */
	onDelete(entry: CacheEntry<Key, Value>): void;

	/**
	 * Hook executed **before** cache has been cleared.
	 */
	onClear(): void;

	/**
	 * Set `deleter` which removes entries from cache.
	 */
	setDeleter(deleter: Deleter<Key, Value>): void;
}

export { CacheReplacementPolicy, Deleter, EntryValidity };
