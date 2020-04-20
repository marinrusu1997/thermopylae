import { object } from '@thermopylae/lib.utils';
import { Seconds } from '@thermopylae/core.declarations';
import { EventEmitter } from 'events';
import { HighResolutionGarbageCollector } from '../high-resolution-garbage-collector';
import { INFINITE_TTL } from "../cache";

class AutoExpirableCache<Key = string, Value = any> extends EventEmitter {
	/**
	 * Configurable options
	 */
	private readonly config: Config;

	/**
	 * Associative cache
	 */
	private readonly cache: Map<Key, Value>;

	/**
	 * Associated garbage collector
	 */
	private readonly gc: HighResolutionGarbageCollector<Key>;

	/**
	 * Configurable MemCache
	 * @param opts
	 */
	constructor(opts?: Partial<Config>) {
		super();

		this.config = AutoExpirableCache.fillWithDefaults(opts);
		this.cache = new Map<Key, Value>();
		this.gc = new HighResolutionGarbageCollector<Key>(key => {
			if (this.cache.delete(key)) {
				this.emit('expired', key);
			}
		});
	}

	/**
	 * Inserts a single item in the cache.
	 * Must be used with special care, as this method will replace cache content,
	 * add a new timer, but the old one timer will not be replaced.
	 * This will lead key being deleted prematurely by the old timer.
	 * Moreover, the new timer will still be active, and might try to scheduleDeletion newly added key.
	 *
	 * Use this method when you are sure 100% no inserts will be made until key expires.
	 *
	 * @param key		Key
	 * @param value		Value
	 * @param ttlSec 	Time to live in seconds
	 *
	 * @deprecated
	 */
	public set(key: Key, value: Value, ttlSec?: Seconds): this {
		if (this.config.useClones) {
			value = object.cloneDeep(value);
		}
		this.cache.set(key, value);

		if (ttlSec == null) {
			ttlSec = this.config.defaultTtlSec;
		}
		this.gc.scheduleDeletion(key, ttlSec);

		this.emit('set', key, value, ttlSec);

		return this;
	}

	/**
	 * Stores multiple items. Time to live must be in seconds.
	 *
	 * @param 	items
	 *
	 * @deprecated
	 */
	public mset(items: Array<CachedItem<Key, Value>>): this {
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
	 */
	public upset(key: Key, value: Value, ttlSec?: Seconds): this {
		if (typeof this.cache.get(key) === 'undefined') {
			return this.set(key, value, ttlSec);
		}

		this.cache.set(key, value);

		if (ttlSec == null) {
			ttlSec = this.config.defaultTtlSec;
		}
		this.gc.reScheduleDeletion(key, ttlSec);

		this.emit('update', key, value, ttlSec);

		return this;
	}

	/**
	 * Retrieves one entry
	 *
	 * @param key
	 */
	public get(key: Key): Value | undefined {
		return this.cache.get(key);
	}

	/**
	 * Retrieves multiple entries
	 *
	 * @param keys
	 */
	public mget(keys: Array<Key>): Array<CachedItem<Key, Value>> {
		const items: Array<CachedItem<Key, Value>> = [];
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
	 * Retrieve number of elements in cache
	 */
	public size(): number {
		return this.cache.size;
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
		this.emit('clear');
	}

	/**
	 * Wrapper for EventEmitter providing type definitions for input arguments.
	 *
	 * @param event
	 * @param listener
	 */
	public on(event: EventType, listener: Listener<Key, Value>): this {
		return super.on(event, listener);
	}

	private static fillWithDefaults(opts?: Partial<Config>): Config {
		return {
			defaultTtlSec: (opts && opts.defaultTtlSec) || INFINITE_TTL,
			useClones: (opts && opts.useClones) || false
		};
	}
}

interface CachedItem<Key = string, Value = any> {
	key: Key;
	value: Value;
	ttlSec?: Seconds;
}

interface Config {
	defaultTtlSec: Seconds;
	useClones: boolean;
}

type EventType = 'set' | 'update' | 'expired' | 'clear';

type Listener<Key = string, Value = any> = (key: Key, value: Value, ttlSec: Seconds) => void;

export { AutoExpirableCache, EventType, Listener, Config };
