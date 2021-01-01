import { Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheStats } from './commons';

/**
 * Represents an abstraction over cache entries processing level. <br/>
 *
 * Middle-end is able to apply different transformations with the {@link CacheEntry},
 * before and after backend is interrogated, this way it might change the behaviour seen by frontend.
 * For example, when a request comes to retrieve value associated with key, it might detect
 * that key is expired, delete it, and return `undefined` to client.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare interface CacheMiddleEnd<Key, Value> {
	/**
	 * Get the value associated with `key`.
	 *
	 * @param key	Name of the key.
	 */
	get(key: Key): Undefinable<Value>;

	/**
	 * Set `value` associated with `key`.
	 *
	 * // @fixme this needs to be removed
	 *
	 * @param key			Name of the key.
	 * @param value			It's associated value.
	 * @param ttl			Time to live for `key`. <br/>
	 * 						Use {@link INFINITE_TTL} to specify that the key should not expire.
	 * @param expiresFrom	Timestamp in the future from when `ttl` starts counting.
	 */
	set(key: Key, value: Value, ttl: Seconds, expiresFrom?: UnixTimestamp): void;

	/**
	 * Replace old value of the `key` with new `value`.
	 *
	 *
	 * @param key			Name of the key.
	 * @param value			New value.
	 * @param ttl			Time to live for `key`. Same rules apply as for ttl in {@link CacheFrontend.upset} method.
	 * @param expiresFrom	Timestamp in the future from when `ttl` starts counting.
	 *
	 * @returns 	Whether value was replaced or not.
	 */
	replace(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): boolean;

	/**
	 * Set the `ttl` for `key`.
	 *
	 * @param key			Name of the key.
	 * @param ttl			Time to live for `key`. Same rules apply as for ttl in {@link CacheFrontend.upset} method.
	 * @param expiresFrom	Timestamp in the future from when `ttl` starts counting.
	 *
	 * @returns		Whether ttl was updated.
	 */
	ttl(key: Key, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean;

	/**
	 * Delete `key` and it's associated value.
	 *
	 * @param key	Name of the key.
	 *
	 * @returns		Whether `key` was removed.
	 */
	del(key: Key): boolean;

	/**
	 * Get all cache keys.
	 */
	keys(): Array<Key>;

	/**
	 * Clear all cache entries.
	 */
	clear(): void;

	/**
	 * Number of cache entries.
	 */
	readonly size: number;

	/**
	 * Cache statistics.
	 */
	readonly stats: CacheStats;
}

export { CacheMiddleEnd };
