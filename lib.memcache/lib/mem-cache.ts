import { object } from '@thermopylae/lib.utils';
import { EventEmitter } from 'events';
import { GarbageCollector, INFINITE_TTL } from './garbage-collector';

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
	constructor(opts?: Partial<Config>) {
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
	 * @param ttlSec 	Time to live in seconds
	 */
	public set(key: Key, value: Value, ttlSec?: number): this {
		value = this.config.useClones ? object.cloneDeep(value) : value;
		this.cache.set(key, value);

		ttlSec = ttlSec != null ? ttlSec : this.config.defaultTtlSec;
		if (ttlSec > INFINITE_TTL) {
			this.gc.track(key, ttlSec);
		}

		this.events.emit('set', key, value);

		return this;
	}

	/**
	 * Stores multiple items. Time to live must be in seconds.
	 * @param 	items
	 */
	public mset(items: Array<CacheableItem<Key, Value>>): this {
		items.forEach(item => this.set(item.key, item.value, item.ttlSec));

		return this;
	}

	/**
	 * Inserts a new entry in cache if the key not found.
	 * Updates entry and ttl if key is found.
	 *
	 * @param key
	 * @param value
	 * @param ttlSec
	 *
	 * @return {boolean} success only when key found in cache, and then replaced it content. if key not found returns false
	 */
	public upset(key: Key, value: Value, ttlSec?: number): this {
		if (typeof this.cache.get(key) === 'undefined') {
			return this.set(key, value, ttlSec);
		}

		this.cache.set(key, value);

		ttlSec = ttlSec != null ? ttlSec : this.config.defaultTtlSec;
		this.gc.updateTtl(key, ttlSec);

		return this;
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
	 * Check cache is empty
	 */
	public empty(): boolean {
		return this.cache.size === 0;
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
	public on(event: EventType, listener: Listener<Key, Value>): this {
		this.events.on(event, listener);
		return this;
	}

	/**
	 * Removes listener for an event
	 *
	 * @param {EventType}	event
	 * @param {Listener}	listener
	 */
	public off(event: EventType, listener: Listener<Key, Value>): this {
		this.events.off(event, listener);
		return this;
	}

	/**
	 * Removes all listeners for an event
	 *
	 * @param {EventType} 	event
	 */
	public removeAllListeners(event: EventType): this {
		this.events.removeAllListeners(event);
		return this;
	}
}

interface Config {
	defaultTtlSec: number;
	useClones: boolean;
}

interface CacheableItem<Key = string, Value = any> {
	key: Key;
	value: Value;
	ttlSec?: number;
}

type EventType = 'set' | 'expired' | 'clear';
type Listener<Key, Value> = (key?: Key, value?: Value) => void;

function fillWithDefaults(opts?: Partial<Config>): Config {
	return {
		defaultTtlSec: (opts && opts.defaultTtlSec) || INFINITE_TTL,
		useClones: (opts && opts.useClones) || false
	};
}

export { MemCache };
