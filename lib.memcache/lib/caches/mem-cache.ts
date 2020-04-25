import { EventEmitter } from 'events';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { object } from '@thermopylae/lib.utils';
import { INFINITE_KEYS, INFINITE_TTL } from '../constants';
import { Cache, CachedItem, ExpirableCacheValue, CacheStats, EventListener, EventType } from '../contracts/cache';
import { ExpirationPolicy } from '../contracts/expiration-policy';
import { EvictionPolicy } from '../contracts/eviction-policy';
import { NoExpirationPolicy } from '../expiration-policies/no-expiration-policy';
import { NoEvictionPolicy } from '../eviction-policies/no-eviction-policy';

interface MemCacheConfig {
	useClones: boolean;
	maxKeys: number;
}

class MemCache<Key = string, Value = any, Entry extends ExpirableCacheValue<Value> = ExpirableCacheValue<Value>> extends EventEmitter
	implements Cache<Key, Value> {
	protected readonly config: MemCacheConfig;

	protected readonly cacheStats: CacheStats;

	protected readonly cache: Map<Key, Entry>;

	protected readonly expirationPolicy: ExpirationPolicy<Key>;

	protected readonly evictionPolicy: EvictionPolicy<Key, Value, Entry>;

	protected constructor(
		config?: Partial<MemCacheConfig>,
		expirationPolicy: ExpirationPolicy<Key> = new NoExpirationPolicy<Key>(),
		evictionPolicy?: EvictionPolicy<Key, Value, Entry>
	) {
		super();

		this.config = this.fillWithDefaults(config);
		this.cacheStats = { hits: 0, misses: 0 };
		this.cache = new Map();
		this.expirationPolicy = expirationPolicy;
		this.evictionPolicy = evictionPolicy || new NoEvictionPolicy<Key, Value, Entry>(this.config.maxKeys);

		this.expirationPolicy.setDeleter(key => this.internalDelete(key, 'expired', false, true));
		this.evictionPolicy.setDeleter(key => this.internalDelete(key, 'evicted', true, false));
	}

	public set(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this {
		const wrappedEntry = this.evictionPolicy.onSet(
			key,
			{
				value: this.config.useClones ? object.cloneDeep(value) : value,
				expiresAt: this.expirationPolicy.expiresAt(key, ttl || INFINITE_TTL, expiresFrom)
			} as Entry,
			this.cache.size
		) as Entry;

		this.cache.set(key, wrappedEntry);
		this.emit('set', key, value);

		return this;
	}

	public upset(key: Key, value: Value, ttl: Seconds | null, expiresFrom?: UnixTimestamp): this {
		const entry = this.internalGetEntry(key);

		if (entry !== undefined) {
			entry.value = this.config.useClones ? object.cloneDeep(value) : value;
			if (ttl !== null) {
				entry.expiresAt = this.expirationPolicy.updateExpiresAt(key, ttl, expiresFrom);
			}

			this.cache.set(key, entry);
			this.emit('update', key, value);

			return this;
		}

		return this.set(key, value, ttl!);
	}

	public get(key: Key): Value | undefined {
		return this.internalGetValue(key);
	}

	public mget(keys: Array<Key>): Array<CachedItem<Key, Value>> {
		const items: Array<CachedItem<Key, Value>> = [];

		let value;
		// eslint-disable-next-line no-restricted-syntax
		for (const key of keys) {
			value = this.get(key);
			if (value !== undefined) {
				items.push({ key, value });
			}
		}

		return items;
	}

	public take(key: Key): Value | undefined {
		const value = this.internalGetValue(key);
		if (value === undefined) {
			return value;
		}

		this.del(key);

		return value;
	}

	public ttl(key: Key, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean {
		const entry = this.internalGetEntry(key);
		if (entry === undefined) {
			return false;
		}

		entry.expiresAt = this.expirationPolicy.updateExpiresAt(key, ttl, expiresFrom);

		return true;
	}

	public has(key: Key): boolean {
		return this.internalGetEntry(key) !== undefined;
	}

	public del(key: Key): boolean {
		return this.internalDelete(key, 'del');
	}

	public mdel(keys: Array<Key>): void {
		// eslint-disable-next-line no-restricted-syntax
		for (const key of keys) {
			this.del(key);
		}
	}

	public keys(): Array<Key> {
		return Array.from(this.cache.keys());
	}

	public stats(): CacheStats {
		return object.cloneDeep(this.cacheStats);
	}

	public get size(): number {
		return this.cache.size;
	}

	public empty(): boolean {
		return this.cache.size !== 0;
	}

	public clear(): void {
		this.cache.clear();
		this.expirationPolicy.onClear();
		this.evictionPolicy.onClear();

		this.cacheStats.misses = 0;
		this.cacheStats.hits = 0;

		this.emit('flush');
	}

	public on(event: EventType, listener: EventListener<Key, Value>): this {
		return super.on(event, listener);
	}

	// following methods were duplicated for speed

	protected internalGetEntry(key: Key): Entry | undefined {
		const entry = this.cache.get(key);

		if (entry === undefined) {
			this.cacheStats.misses += 1;
			return entry;
		}

		if (this.expirationPolicy.isExpired(key, entry.expiresAt)) {
			return undefined;
		}

		this.cacheStats.hits += 1;
		this.evictionPolicy.onGet(key, entry);
		return entry;
	}

	protected internalGetValue(key: Key): Value | undefined {
		const entry = this.cache.get(key);

		if (entry === undefined) {
			this.cacheStats.misses += 1;
			return entry;
		}

		if (this.expirationPolicy.isExpired(key, entry.expiresAt)) {
			return undefined;
		}

		this.cacheStats.hits += 1;
		this.evictionPolicy.onGet(key, entry);
		return entry.value;
	}

	protected internalDelete(key: Key, event: EventType, notifyExpirationPolicy = true, notifyEvictionPolicy = true): boolean {
		let entry;
		if (notifyEvictionPolicy && this.evictionPolicy.requiresEntryForDeletion) {
			entry = this.cache.get(key);

			if (entry === undefined) {
				return false;
			}
		}

		if (this.cache.delete(key)) {
			if (notifyExpirationPolicy) {
				this.expirationPolicy.onDelete(key);
			}
			if (notifyEvictionPolicy) {
				this.evictionPolicy.onDelete(key, entry);
			}
			this.emit(event, key);
			return true;
		}

		return false;
	}

	protected fillWithDefaults(options?: Partial<MemCacheConfig>): MemCacheConfig {
		options = options || {};
		options.maxKeys = options.maxKeys || INFINITE_KEYS;
		options.useClones = options.useClones || false;
		return options as MemCacheConfig;
	}
}

export { MemCache, MemCacheConfig };
