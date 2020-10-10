import { Undefinable } from '@thermopylae/core.declarations';
import { CacheEntry } from './commons';

/**
 * Represents an abstraction over the cache storage.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare interface CacheBackend<Key, Value> {
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
	 * @param key		Name of the key.
	 * @param entry		Whether to return the deleted entry.
	 *
	 * @returns		Depending of the `entry` value will return: <br/>
	 *
	 * Value	| Returns
	 * -------- | -----------------------------------------------------
	 * `true`	| {@link CacheEntry} that was deleted (if found)
	 * `false`	| Boolean flag that indicates whether entry was deleted
	 */
	del(key: Key, entry: boolean): boolean | Undefinable<CacheEntry<Value>>;

	/**
	 * Returns an iterator over stored keys.
	 */
	keys(): IterableIterator<Key>;

	/**
	 * Remove all entries from storage.
	 */
	clear(): void;

	/**
	 * Iterate over stored entries.
	 */
	[Symbol.iterator](): IterableIterator<[Key, CacheEntry<Value>]>;

	/**
	 * Number of stored entries.
	 */
	readonly size: number;
}

export { CacheBackend };
