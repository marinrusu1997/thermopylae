import { UnixTimestamp } from '@thermopylae/core.declarations';

/**
 * Event emitted by {@link CacheFrontend}.
 */
declare type EventType = 'set' | 'update' | 'del' | 'flush';

/**
 * Event listener for {@link EventType}.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

/**
 * Describes collected cache statistics.
 */
declare interface CacheStats {
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

export { EventType, EventListener, CacheStats, CacheKey, CacheEntry };
