import { Label, Seconds, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheStats, EventType, EventListener } from './commons';

/**
 * Represents an abstraction over cache interface. <br/>
 * This is the layer clients interact with.
 *
 * @template Key 	Type of the key.
 * @template Value	Type of the value.
 */
declare interface CacheFrontend<Key, Value> {
	/**
	 * Name of the cache.
	 */
	readonly name: Label;

	/**
	 * Set `value` for `key. <br/>
	 * **This method needs to be used when you are sure that key is not present.**
	 *
	 * // @fixme this needs to be removed
	 *
	 * @param key			Name of the key.
	 * @param value			Associated value.
	 * @param ttl			Time to live.
	 * @param expiresFrom	Timestamp in the future from when `ttl` starts counting.
	 */
	set(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this;

	/**
	 * Upset `value` for `key`.<br/>
	 * If `key` is present already, it's value and metadata are updated accordingly.<br/>
	 * Depending on the value of `ttl` param, following behaviours will occur. <br/>
	 *
	 * Value						| Behaviour
	 * ---------------------------- | -------------------------------
	 * `undefined`  				| New value has no ttl and will never expire.
	 * {@link INFINITE_TTL}  		| New value has no ttl and will never expire.
	 * ttl of old value				| New value inherits ttl of the old value.<br>Notice that timer is not reset, meaning that if old value remains to live `x` seconds, the new one will remain same `x` seconds.
	 * ttl different from old value	| New value has new ttl.<br>Timer of old value is reset, so that new value remains to live `ttl` seconds.
	 *
	 * @param key			Name of the key.
	 * @param value			Associated value.
	 * @param ttl			Time to live for `key`. <br>
	 * 						Use {@link INFINITE_TTL} to specify that the key should not expire.
	 * @param expiresFrom	Timestamp in the future from when `ttl` starts counting.
	 */
	upset(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this;

	/**
	 * Get the value associated with `key`.
	 *
	 * @param key	Name of the key.
	 */
	get(key: Key): Undefinable<Value>;

	/**
	 * Get values for multiple keys.
	 *
	 * @param keys	Name of the keys.
	 */
	mget(keys: Array<Key>): Map<Key, Undefinable<Value>>; // @fixme useless shit

	/**
	 * Take `key` from cache.
	 * If key is present, it will be removed before returning it's value.
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
	 * Delete multiple keys from cache.
	 *
	 * @param keys	Name of the keys.
	 */
	mdel(keys: Array<Key>): void; // @fixme useless shit

	/**
	 * Set `ttl` for `key`.
	 *
	 * @param key			Name of the key.
	 * @param ttl			Time to live for `key`. Same rules apply as for ttl in {@link CacheFrontend.upset} method.
	 * @param expiresFrom	Timestamp in the future from when `ttl` starts counting.
	 *
	 * @returns		Whether ttl was updated.
	 */
	ttl(key: Key, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean;

	/**
	 * Get all keys from cache.
	 */
	keys(): Array<Key>;

	/**
	 * Check whether cache contains `key`.
	 *
	 * @param key	Name of the key.
	 */
	has(key: Key): boolean;

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

	/**
	 * Add `listener` for `event`.
	 *
	 * @param event		Name of the event.
	 * @param listener	Event listener.
	 */
	on(event: EventType, listener: EventListener<Key, Value>): this;
}

export { CacheFrontend };
