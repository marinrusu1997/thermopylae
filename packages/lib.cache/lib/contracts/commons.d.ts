/**
 * Represents `key` stored as metadata along with the value.
 *
 * @template Key	Type of the key.
 */
declare interface CacheKey<Key> {
	key: Key;
}

/**
 * Represents the entry that is actually stored in the cache,
 * and contains `value` corresponding to `key`.
 *
 * @template Value	Type of the value.
 */
declare interface CacheEntry<Value> {
	value: Value;
}

export { CacheKey, CacheEntry };
