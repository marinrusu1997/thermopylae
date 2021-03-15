import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheEntry } from './commons';

/**
 * Function, that given a `key`, will remove it from storage. <br/>
 * Deleter makes policy able to delete entries on his own, when it detects that they should no longer be kept.
 *
 * @param key	Name of the key.
 */
declare type Deleter<Key> = (key: Key) => void; // @fixme maybe deleter should also accept entry as argument

/**
 * Context associated with cache set operation.
 */
declare interface SetOperationContext {
	// @fixme needs to be removed

	/**
	 * Number of the elements in the cache.
	 */
	totalEntriesNo: number;
	/**
	 * Ttt of the {@link CacheEntry}.
	 */
	expiresAfter?: Seconds;
	/**
	 * Timestamp from when ttl starts counting.
	 */
	expiresFrom?: UnixTimestamp;
}

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
 *
 * @template Key 	Type of the key.
 * @template Value	Type of the value.
 */
declare interface CacheReplacementPolicy<Key, Value> {
	// @fixme remove key from this interface, it should be middleend job to set it
	/**
	 * Hook executed after `entry` for `key` was retrieved.
	 *
	 * @param key		Name of the key.
	 * @param entry		Associated entry.
	 *
	 * @returns		Whether entry is still valid.
	 */
	onHit(key: Key, entry: CacheEntry<Value>): EntryValidity;

	/**
	 * Hook executed after `key` was not found in {@link Cache};
	 *
	 * @param key		Name of the key.
	 */
	onMiss(key: Key): void; // @fixme there we should also receive entry

	/**
	 * Hook executed after `entry` for `key` has been set.
	 *
	 * @param key		Name of the key.
	 * @param entry		Associated entry.
	 * @param context	Cache operation context.
	 */
	onSet(key: Key, entry: CacheEntry<Value>, context: SetOperationContext): void; // @fixme update with template param as ArgumentsBundle

	/**
	 * Hook executed after value for `entry` related with `key` has been replaced.
	 *
	 * @param key		Name of the key.
	 * @param entry		Associated entry.
	 * @param context	Cache operation context.
	 */
	onUpdate(key: Key, entry: CacheEntry<Value>, context: SetOperationContext): void; // @fixme maybe it needs to remain, middleend will decide which one to call

	/**
	 * Hook executed after `entry` for `key` has been deleted.
	 *
	 * @param key		Name of the key.
	 * @param entry		Associated entry.
	 */
	onDelete(key: Key, entry: CacheEntry<Value>): void;
	// @fixme each policy should detach metadata from entry after eviction/delete, as entry might be reused by backend

	/**
	 * Hook executed after cache has been cleared.
	 */
	onClear(): void;

	/**
	 * Set `deleter` which removes entries from cache.
	 */
	setDeleter(deleter: Deleter<Key>): void;
}

export { CacheReplacementPolicy, Deleter, SetOperationContext, EntryValidity };
