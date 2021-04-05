import { CacheEntry } from './commons';

interface CacheBackendElementsCount {
	/**
	 * Number of stored entries.
	 */
	readonly size: number;
}

/**
 * Cache backend iterable protocol.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
interface IterableCacheBackend<Key, Value> extends Iterable<[Key, CacheEntry<Value>]>, CacheBackendElementsCount {
	/**
	 * Returns an iterable of stored keys.
	 */
	keys(): IterableIterator<Key>;

	/**
	 * Returns an iterable of stored values.
	 */
	values(): IterableIterator<CacheEntry<Value>>;

	/**
	 * Iterate over stored entries.
	 */
	[Symbol.iterator](): IterableIterator<[Key, CacheEntry<Value>]>;
}

/**
 * Represents an abstraction over the cache storage. <br/>
 * Clients might perform only read operations on storage.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare interface ReadonlyCacheBackend<Key, Value> {
	/**
	 * Get the {@link CacheEntry} associated with `key`.
	 *
	 * @param key	Name of the key.
	 */
	get(key: Key): CacheEntry<Value> | undefined;

	/**
	 * Check if `key` is present in the cache.
	 *
	 * @param key	Name of the key.
	 */
	has(key: Key): boolean;
}

/**
 * Represents an abstraction over the cache storage.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare interface CacheBackend<Key, Value> extends ReadonlyCacheBackend<Key, Value>, IterableCacheBackend<Key, Value> {
	/**
	 * Store *key* with *value*. <br/>
	 * > 							⚠️ WARNING ⚠️
	 * **This method should not be used to overwrite *value* of the *key*!** <br/>
	 * **You need to query the entry first and update value on the entry object.**
	 *
	 * @param key		Name of the key.
	 * @param value		Value associated with key.
	 *
	 * @returns	{@link CacheEntry} stored by backend. <br/>
	 *     		Upper level abstractions can attach properties to this object.
	 */
	set(key: Key, value: Value): CacheEntry<Value>;

	/**
	 * Delete `key`.
	 *
	 * @param key	Name of the key.
	 *
	 * @returns		Boolean flag that indicates whether entry was deleted.
	 */
	del(key: Key): boolean;

	/**
	 * Remove all entries from storage.
	 */
	clear(): void;
}

export { CacheBackend, ReadonlyCacheBackend, IterableCacheBackend, CacheBackendElementsCount };
