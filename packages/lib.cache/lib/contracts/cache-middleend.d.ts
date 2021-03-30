import { Undefinable } from '@thermopylae/core.declarations';
import { CacheEventEmitter } from './cache-event-emitter';

/**
 * Represents an abstraction over cache entries processing level. <br/>
 *
 * Middle-end is able to apply different transformations with the {@link CacheEntry},
 * before and after backend is interrogated, this way it might change the behaviour seen by frontend.
 * For example, when a request comes to retrieve value associated with key, it might detect
 * that key is expired, delete it, and return `undefined` to client.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle passed to different operations.
 */
declare interface CacheMiddleEnd<Key, Value, ArgumentsBundle> {
	/**
	 * Number of cache entries.
	 */
	readonly size: number;

	/**
	 * {@link CacheEventEmitter} instance with controls cache events.
	 */
	readonly events: CacheEventEmitter<Key, Value>;

	/**
	 * Get the value associated with `key`.
	 *
	 * @param key	Name of the key.
	 */
	get(key: Key): Undefinable<Value>;

	/**
	 * Set `value` associated with `key`.
	 *
	 * @param key			Name of the key.
	 * @param value			It's associated value.
	 * @param argsBundle	Bundle of arguments passed by client for this operation.
	 */
	set(key: Key, value: Value, argsBundle?: ArgumentsBundle): void;

	/**
	 * Check if `key` is present in the cache.
	 *
	 * @param key	Name of the key.
	 */
	has(key: Key): boolean;

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
}

export { CacheMiddleEnd };
