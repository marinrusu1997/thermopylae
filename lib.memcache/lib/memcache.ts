import { misc } from '@marin/lib.utils';
import { EventEmitter } from 'events';
import { GarbageCollector } from './garbage-collector';

class MemCache<Key = string, Value = any> {
	/**
	 * Configurable options
	 */
	private readonly config: Config;

	/**
	 * Associative cache
	 */
	private readonly cache: Map<Key, Value>;

	/**
	 * Event emitter
	 */
	private readonly events: EventEmitter;

	/**
	 * Associated garbage collector
	 */
	private readonly gc: GarbageCollector<Key>;

	/**
	 * Configurable MemCache
	 * @param opts
	 */
	constructor(opts?: Options) {
		this.config = fillWithDefaults(opts);
		this.cache = new Map<Key, Value>();
		this.events = new EventEmitter();
		this.gc = new GarbageCollector<Key>(key => {
			if (this.cache.delete(key)) {
				this.events.emit('expired', key);
			}
		});
	}

	/**
	 * Sets one item
	 *
	 * @param key		Key
	 * @param value		Value
	 * @param ttl 		Time to live in seconds
	 */
	public set(key: Key, value: Value, ttl?: number): void {
		value = this.config.useClones ? misc.cloneDeep(value) : value;
		this.cache.set(key, value);
		ttl = ttl || this.config.stdTTL;
		if (ttl > 0) {
			this.gc.track(key, ttl);
		}
		this.events.emit('set', key, value);
	}

	/**
	 * Stores multiple items. Time to live must be in seconds.
	 * @param 	items
	 */
	public mset(items: Array<CacheableItem<Key, Value>>): void {
		items.forEach(item => this.set(item.key, item.value, item.ttl));
	}

	/**
	 * Replaces the content stored under specified key, without modifying its ttl timer.
	 * If you want to update the value with updating also the timer,
	 * you have to delete the item, then add it again.
	 *
	 * @param key
	 * @param value
	 *
	 * @return {boolean} success only when key found in cache, and then replaced it content. if key not found returns false
	 */
	public replace(key: Key, value: Value): boolean {
		if (this.cache.get(key)) {
			this.cache.set(key, value);
			return true;
		}
		return false;
	}

	/**
	 * Retrieves one entry
	 * @param key
	 */
	public get(key: Key): Value | undefined {
		return this.cache.get(key);
	}

	/**
	 * Retrieves multiple entries
	 * @param keys
	 */
	public mget(keys: Array<Key>): Array<CacheableItem<Key, Value>> {
		const items: Array<CacheableItem<Key, Value>> = [];
		for (let i = 0; i < keys.length; i += 1) {
			const value = this.get(keys[i]);
			if (value) {
				items.push({ key: keys[i], value });
			}
		}
		return items;
	}

	/**
	 * Removes entry from cache
	 * @param key
	 */
	public del(key: Key): boolean {
		const deleted = this.cache.delete(key);
		if (deleted) {
			this.events.emit('del', key);
		}
		return deleted;
		// no need to notify GC about this, he will just ignore it
	}

	/**
	 * Removes multiple entries from cache
	 * @param keys
	 */
	public mdel(keys: Array<Key>): Array<boolean> {
		const deletionStatuses: boolean[] = [];
		for (let i = 0; i < keys.length; i += 1) {
			deletionStatuses.push(this.del(keys[i]));
		}
		return deletionStatuses;
	}

	/**
	 * Retrieves all existing keys
	 */
	public keys(): Array<Key> {
		return Array.from(this.cache.keys());
	}

	/**
	 * Check if key exists in cache
	 * @param key
	 */
	public has(key: Key): boolean {
		return this.cache.has(key);
	}

	/**
	 * Flush all entries from cache (i.e clears the cache)
	 */
	public clear(): void {
		this.cache.clear();
		this.gc.stop();
		this.events.emit('clear');
	}

	/**
	 * Registers listener for an event
	 *
	 * @param event
	 * @param listener
	 */
	public on(event: EventType, listener: Listener<Key, Value>): MemCache<Key, Value> {
		this.events.on(event, listener);
		return this;
	}

	/**
	 * Removes listener for an event
	 *
	 * @param {EventType}	event
	 * @param {Listener}	listener
	 */
	public off(event: EventType, listener: Listener<Key, Value>): MemCache<Key, Value> {
		this.events.off(event, listener);
		return this;
	}

	/**
	 * Removes all listeners for an event
	 *
	 * @param {EventType} 	event
	 */
	public removeAllListeners(event: EventType): MemCache<Key, Value> {
		this.events.removeAllListeners(event);
		return this;
	}
}

interface Options {
	stdTTL?: number;
	useClones?: boolean;
}

interface Config {
	stdTTL: number;
	useClones: boolean;
}

interface CacheableItem<Key = string, Value = any> {
	key: Key;
	value: Value;
	ttl?: number;
}

type EventType = 'set' | 'del' | 'expired' | 'clear';
type Listener<Key, Value> = (key?: Key, value?: Value) => void;

function fillWithDefaults(opts?: Options): Config {
	return {
		stdTTL: (opts && opts.stdTTL) || 0,
		useClones: (opts && opts.useClones) || false
	};
}

export { MemCache };
