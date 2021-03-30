import { Label, Undefinable } from '@thermopylae/core.declarations';
import { CacheStats } from './commons';

/**
 * Represents an abstraction over cache interface. <br/>
 * This is the layer clients interact with.
 *
 * @template Key 				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle used by different operations.
 */
declare interface CacheFrontend<Key, Value, ArgumentsBundle> {
	/**
	 * Name of the cache.
	 */
	readonly name: Label;

	/**
	 * Get the value associated with `key`.
	 *
	 * @param key	Name of the key.
	 */
	get(key: Key): Undefinable<Value>;

	/**
	 * Set `value` for `key.
	 *
	 * @param key			Name of the key.
	 * @param value			Associated value.
	 * @param argsBundle	Bundle of arguments passed by client for this operation.
	 */
	set(key: Key, value: Value, argsBundle?: ArgumentsBundle): this;

	/**
	 * Check whether cache contains `key`.
	 *
	 * @param key	Name of the key.
	 */
	has(key: Key): boolean;

	/**
	 * Take `key` from cache.
	 *
	 * @param key	Name of the key.
	 */
	take(key: Key): Undefinable<Value>;

	/**
	 * Delete `key` from cache.
	 *
	 * @param key	Name of the key.
	 *
	 * @returns		Whether key was removed.
	 */
	del(key: Key): boolean;

	/**
	 * Get all keys from cache.
	 */
	keys(): Array<Key>;

	/**
	 * Remove all entries from cache.
	 */
	clear(): void;

	/**
	 * Check whether cache is empty.
	 */
	readonly empty: boolean;

	/**
	 * Number of keys in the cache.
	 */
	readonly size: number;

	/**
	 * Cache statistics.
	 */
	readonly stats: CacheStats;
}

export { CacheFrontend };
