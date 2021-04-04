import { MaybePromise } from '@thermopylae/core.declarations';

/**
 * Event emitted by {@link Cache}.
 */
declare const enum CacheEvent {
	INSERT = 'insert',
	UPDATE = 'update',
	DELETE = 'delete',
	FLUSH = 'flush'
}

/**
 * Event listener for {@link CacheEvent}.
 *
 * @template Key	Type of the key.
 * @template Value	Type of the value.
 */
declare type CacheEventListener<Key, Value> = (key: Key, value: Value) => void;

/**
 * Represents an abstraction over different cache implementations. <br/>
 *
 * Cache is able to apply different transformations with the {@link CacheEntry},
 * before and after backend is interrogated, this way it might change the behaviour seen by clients.
 * For example, when a request comes to retrieve value associated with key, it might detect
 * that key is expired, delete it, and return `undefined` to client.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle passed to different operations.
 * @template Returns			Type of the return value.
 */
declare interface Cache<Key, Value, ArgumentsBundle, Returns extends 'plain' | 'promise' = 'plain'> {
	/**
	 * Number of cache entries.
	 */
	readonly size: number;

	/**
	 * Get the `value` associated with `key`.
	 *
	 * @param key			Name of the key.
	 * @param argsBundle	Bundle of arguments passed by client for this operation.
	 */
	get(key: Key, argsBundle?: ArgumentsBundle): MaybePromise<Value | undefined, Returns>;

	/**
	 * Set `value` associated with `key`. <br/>
	 * After successful insertion/update, according {@link CacheEvent.INSERT}, respectively {@link CacheEvent.UPDATE}
	 * events will be emitted.
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
	 * Delete `key` and it's associated value. <br/>
	 * After successful deletion, {@link CacheEvent.DELETE} event will be emitted.
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
	 * Clear all cache entries. <br/>
	 * After successful clear, {@link CacheEvent.FLUSH} event will be emitted.
	 */
	clear(): void;

	/**
	 * Register event listener.
	 *
	 * @param event			Cache event.
	 * @param listener		Event listener.
	 */
	on(event: CacheEvent, listener: CacheEventListener<Key, Value>): this;

	/**
	 * Unregister event listener.
	 *
	 * @param event			Cache event.
	 * @param listener		Event listener.
	 */
	off(event: CacheEvent, listener: CacheEventListener<Key, Value>): this;
}

export { Cache, CacheEvent, CacheEventListener };
