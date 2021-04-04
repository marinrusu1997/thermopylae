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

export { CacheKey, CacheEntry };
