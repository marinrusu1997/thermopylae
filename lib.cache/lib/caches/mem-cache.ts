import { EventEmitter } from 'events';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { object } from '@thermopylae/lib.utils';
import { INFINITE_KEYS, INFINITE_TTL } from '../constants';
import { Cache, CachedItem, CacheEntry, CacheStats, EventListener, EventType } from '../contracts/cache';
import { ExpirationPolicy } from '../contracts/expiration-policy';
import { EvictionPolicy } from '../contracts/eviction-policy';
import { NoExpirationPolicy } from '../expiration-policies';
import { NoEvictionPolicy } from '../eviction-policies/no-eviction-policy';
import { TtlRegistry } from '../helpers/ttl-registry';

interface MemCacheConfig<Key, Value, Entry> {
	useClones: boolean;
	maxKeys: number;
	entryBuilder: (key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp) => Entry;
}

class MemCache<Key = string, Value = any, Entry extends CacheEntry<Value> = CacheEntry<Value>> extends EventEmitter implements Cache<Key, Value> {
	protected readonly config: MemCacheConfig<Key, Value, Entry>;

	protected readonly cacheStats: CacheStats;

	protected readonly cache: Map<Key, Entry>;

	protected readonly ttlRegistry: TtlRegistry<Key>;

	protected readonly expirationPolicy: ExpirationPolicy<Key, Value, Entry>;

	protected readonly evictionPolicy: EvictionPolicy<Key, Value, Entry>;

	constructor(
		config?: Partial<MemCacheConfig<Key, Value, Entry>>,
		expirationPolicy?: ExpirationPolicy<Key, Value, Entry>,
		evictionPolicy?: EvictionPolicy<Key, Value, Entry>,
		ttlRegistry?: TtlRegistry<Key>
	) {
		super();

		this.config = this.fillWithDefaults(config);
		this.cacheStats = { hits: 0, misses: 0 };
		this.cache = new Map();
		this.expirationPolicy = expirationPolicy || new NoExpirationPolicy<Key, Value, Entry>();
		this.evictionPolicy = evictionPolicy || new NoEvictionPolicy<Key, Value, Entry>(this.config.maxKeys);
		this.ttlRegistry = ttlRegistry || TtlRegistry.empty<Key>();

		this.expirationPolicy.setDeleter((key) => this.internalDelete(key, 'expired'));
		this.evictionPolicy.setDeleter((key) => this.internalDelete(key, 'evicted'));
	}

	/**
	 * @deprecated use this function when you know that key does not exist in cache 100%
	 */
	public set(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this {
		const entry: Entry = this.config.entryBuilder(key, value, ttl, expiresFrom);
		ttl = ttl ?? this.ttlRegistry.resolve(key);

		this.expirationPolicy.onSet(key, entry, ttl, expiresFrom);
		this.evictionPolicy.onSet(key, entry, this.cache.size);

		this.cache.set(key, entry);
		this.emit('set', key, value);

		return this;
	}

	public upset(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): this {
		const entry = this.internalGetEntry(key);

		if (MemCache.containsEntry(entry)) {
			entry!.value = this.config.useClones ? object.cloneDeep(value) : value;

			if (ttl != null) {
				this.expirationPolicy.onUpdate(key, entry!, ttl, expiresFrom);
			}

			this.emit('update', key, value);

			return this;
		}

		return this.set(key, value, ttl, expiresFrom);
	}

	public get(key: Key): Value | undefined {
		const entry = this.internalGetEntry(key);
		return (entry && entry.value) || MemCache.ENTRY_NOT_PRESENT_VALUE;
	}

	public mget(keys: Array<Key>): Array<CachedItem<Key, Value>> {
		const items: Array<CachedItem<Key, Value>> = [];

		let entry;
		// eslint-disable-next-line no-restricted-syntax
		for (const key of keys) {
			entry = this.internalGetEntry(key);
			if (MemCache.containsEntry(entry)) {
				items.push({ key, value: entry!.value });
			}
		}

		return items;
	}

	public take(key: Key): Value | undefined {
		const entry = this.internalGetEntry(key);
		if (!MemCache.containsEntry(entry)) {
			return MemCache.ENTRY_NOT_PRESENT_VALUE;
		}

		this.del(key);

		return entry!.value;
	}

	public ttl(key: Key, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean {
		const entry = this.internalGetEntry(key);
		if (!MemCache.containsEntry(entry)) {
			return false;
		}

		this.expirationPolicy.onUpdate(key, entry!, ttl, expiresFrom);

		return true;
	}

	public has(key: Key): boolean {
		return MemCache.containsEntry(this.internalGetEntry(key));
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

	protected internalGetEntry(key: Key): Entry | undefined {
		const entry = this.cache.get(key);

		if (!MemCache.containsEntry(entry)) {
			this.cacheStats.misses += 1;
			return MemCache.ENTRY_NOT_PRESENT_VALUE;
		}

		const removed = this.expirationPolicy.removeIfExpired(key, entry!);
		if (removed) {
			return MemCache.ENTRY_NOT_PRESENT_VALUE;
		}

		this.cacheStats.hits += 1;
		this.evictionPolicy.onGet(key, entry!);

		return entry;
	}

	protected internalDelete(key: Key, event: EventType): boolean {
		let entry: Entry | undefined;
		const entryRequiredOnDeletion = this.expirationPolicy.requiresEntryOnDeletion || this.evictionPolicy.requiresEntryOnDeletion;
		if (entryRequiredOnDeletion) {
			entry = this.cache.get(key);

			if (!MemCache.containsEntry(entry)) {
				return false;
			}
		}

		if (this.cache.delete(key)) {
			this.expirationPolicy.onDelete(key, entry);
			this.evictionPolicy.onDelete(key, entry);

			this.emit(event, key);

			return true;
		}

		return false;
	}

	protected fillWithDefaults(options?: Partial<MemCacheConfig<Key, Value, Entry>>): MemCacheConfig<Key, Value, Entry> {
		options = options || {};
		options.maxKeys = options.maxKeys || INFINITE_KEYS;
		options.useClones = options.useClones || false;
		// @ts-ignore
		options.entryBuilder = options.entryBuilder || ((_key: Key, value: Value): Entry => ({ value }));
		return options as MemCacheConfig<Key, Value, Entry>;
	}

	private static ENTRY_NOT_PRESENT_VALUE = undefined;

	private static containsEntry(entry: any): boolean {
		return entry !== MemCache.ENTRY_NOT_PRESENT_VALUE;
	}
}

export { MemCache, MemCacheConfig };
