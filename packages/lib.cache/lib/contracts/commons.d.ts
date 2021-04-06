/**
 * Represents the entry that is actually stored in the cache,
 * and contains `value` corresponding to `key`.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare interface CacheEntry<Key, Value> {
	key: Key;
	value: Value;
}

export { CacheEntry };
