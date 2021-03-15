import { Undefinable } from '@thermopylae/core.declarations';
import { CacheEntry } from './commons';

/**
 * Cache backend iterable protocol.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
interface IterableCacheBackend<Key, Value> extends Iterable<[Key, CacheEntry<Value>]> {
	/**
	 * Iterate over stored entries.
	 */
	[Symbol.iterator](): IterableIterator<[Key, CacheEntry<Value>]>;

	/**
	 * Returns an iterable of stored keys.
	 */
	keys(): IterableIterator<Key>;

	/**
	 * Returns an iterable of stored values.
	 */
	values(): IterableIterator<CacheEntry<Value>>;
}

/**
 * Represents an abstraction over the cache storage.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare interface CacheBackend<Key, Value> extends IterableCacheBackend<Key, Value> {
	/**
	 * Get the {@link CacheEntry} associated with `key`.
	 *
	 * @param key	Name of the key.
	 */
	get(key: Key): Undefinable<CacheEntry<Value>>;

	/**
	 * Store `key` with `value`.
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

	/**
	 * Number of stored entries.
	 */
	readonly size: number;
}

export { CacheBackend, IterableCacheBackend };
