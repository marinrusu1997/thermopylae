import { UnixTimestamp } from '@thermopylae/core.declarations';

/**
 * Represents `key` stored as metadata along with the value.
 */
declare interface CacheKey<Key> {
	key: Key;
}

/**
 * Represents the entry that is actually stored in the cache,
 * and contains `value` corresponding to `key`.
 */
declare interface CacheEntry<Value> {
	value: Value;
}

/**
 * Represents a filter which decides which entries should be returned to client.
 */
declare interface CacheEntryFilter {
	// @fixme integrate this into cache, to filter available entries
	/**
	 * Entries that are not older than a given timestamp. <br/>
	 * Age of the entry is measured since it was inserted in the cache.
	 */
	notOlder: UnixTimestamp;
}

export { CacheKey, CacheEntry };
