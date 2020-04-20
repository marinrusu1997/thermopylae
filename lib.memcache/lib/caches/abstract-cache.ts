import { EventEmitter } from 'events';
import { UnixTimestamp } from '@thermopylae/core.declarations';
import {BaseCacheConfig, Cache, CachedItem, CacheStats, INFINITE_KEYS} from '../cache';
import { createException, ErrorCodes } from '../error';
import { ExpirationPolicy } from '../expiration-policy';
import { EvictionPolicy } from '../eviction-policy';
import { NoExpirationPolicy } from '../expiration-policies/no-expiration-policy';
import { NoEvictionPolicy } from '../eviction-policies/no-eviction-policy';

interface BaseCacheConfig {
	useClones: boolean;
	maxKeys: number;
}

interface BaseCacheEntry<Value> {
	value: Value;
	expires: UnixTimestamp | null;
}

class AbstractCache<Key = string, Value = any> extends EventEmitter implements Cache<Key, Value> {
	protected readonly config: BaseCacheConfig;

	protected readonly cacheStats: CacheStats;

	protected readonly cache: Map<Key, BaseCacheEntry<Value>>;

	protected readonly expirationPolicy: ExpirationPolicy<Key>;

	protected readonly evictionPolicy: EvictionPolicy<Key>;

	protected constructor(config: Partial<BaseCacheConfig>, expirationPolicy = new NoExpirationPolicy<Key>(), evictionPolicy = new NoEvictionPolicy<Key>()) {
		super();

		this.config = this.fillWithDefaults(config);
		this.cacheStats = { hits: 0, misses: 0 };
		this.cache = new Map();
		this.expirationPolicy = expirationPolicy;
		this.evictionPolicy = evictionPolicy;

		this.expirationPolicy.setDeleter(key => {
			if (this.cache.delete(key)) {
				this.emit('expired', key);
			}
		});

		this.evictionPolicy.setDeleter(key => {
			if (this.cache.delete(key)) {
				this.emit('evicted', key);
			}
		});
	}

	public get(key: Key): Value | undefined {
		const entry = this.internalGet(key);
		return entry !== undefined ? entry.value : entry;
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

	public set(key: Key, value: Value, ttl?: Seconds): this {
		return undefined;
	}

	clear(): void {}

	del(key: Key): boolean {
		return false;
	}

	has(key: Key): boolean {
		return false;
	}

	keys(): Array<Key> {
		return undefined;
	}

	mdel(keys: Array<Key>): void {}

	stats(): CacheStats {
		return undefined;
	}

	take(key: Key): Value | undefined {
		return undefined;
	}

	ttl(key: Key, ttl?: Seconds): boolean {
		return false;
	}

	upset(key: Key, value: Value, ttl?: Seconds): this {
		return undefined;
	}

	protected internalGet(key: Key): BaseCacheEntry<Value> | undefined {
		const entry = this.cache.get(key);

		if (entry === undefined) {
			this.cacheStats.misses += 1;
			return entry;
		}

		if (this.expirationPolicy.expired(key, entry.expires)) {
			return undefined;
		}

		this.cacheStats.hits += 1;
		return entry;
	}

	protected guardMaxKeysNumber(): void {
		if (this.config.maxKeys !== INFINITE_KEYS && this.cache.size >= this.config.maxKeys) {
			throw createException(ErrorCodes.CACHE_FULL, `Limit of ${this.config.maxKeys} has been reached. `);
		}
	}

	protected fillWithDefaults(options?: Partial<BaseCacheConfig>): BaseCacheConfig {
		options = options || {};
		options.maxKeys = options.maxKeys || INFINITE_KEYS;
		options.useClones = options.useClones || false;
		return options as BaseCacheConfig;
	}
}

export { AbstractCache, BaseCacheConfig, BaseCacheEntry };
