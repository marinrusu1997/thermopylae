import { UnixTimestamp } from '@thermopylae/core.declarations';

/**
 * Query number of elements in the cache.
 */
declare type CacheSizeGetter = () => number;

/**
 * Get entry associated with *key*.
 */
declare type CacheEntryGetter<Key, Value> = (key: Key) => CacheEntry<Value>;

/**
 * Iterator over {@link CacheBackend} entries. <br/>
 * On each call, it should return next entry. Where no entries remained, it should return *null*.
 */
declare type CacheEntriesIterator<Value> = () => CacheEntry<Value> | null;

/**
 * Describes collected cache statistics.
 */
declare interface CacheStats {
	// @fixme maybe we should remove it, we do unnecessary processing
	/**
	 * Number of cache hits.
	 */
	hits: number;
	/**
	 * Number of cache misses.
	 */
	misses: number;
}

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
	// @fixme integrate this into frontend and middle-end, to filter available entries
	/**
	 * Entries that are not older than a given timestamp. <br/>
	 * Age of the entry is measured since it was inserted in the cache.
	 */
	notOlder: UnixTimestamp;
}

export { CacheSizeGetter, CacheEntryGetter, CacheEntriesIterator, CacheStats, CacheKey, CacheEntry };
