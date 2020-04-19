import { EventEmitter } from 'events';
import { Milliseconds } from '@thermopylae/core.declarations';
import { BaseCacheConfig, Cache, CacheStats, INFINITE_KEYS } from '../cache';
import { GarbageCollector } from '../garbage-collector';
import { createException } from '../error';

interface BaseCacheConfig {
	useClones: boolean;
	maxKeys: number;
}

interface BaseCacheEntry<Value> {
	value: Value;
	ttl: Milliseconds;
	expires: Milliseconds | null;
	trackedByGC?: boolean;
}

declare const enum ErrorCodes {
	CACHE_FULL = 'CACHE_FULL',
	KEY_EXPIRATION_SET = 'KEY_EXPIRATION_SET'
}

abstract class AbstractCache<Key = string, Value = any, Entry = BaseCacheEntry<Value>> extends EventEmitter implements Cache<Key, Value> {
	protected readonly config: BaseCacheConfig;

	protected readonly cacheStats: CacheStats;

	protected readonly cache: Map<Key, Entry>;

	protected readonly gc: GarbageCollector<Key>;

	protected constructor(config: Partial<BaseCacheConfig>) {
		super();

		this.config = this.fillWithDefaults(config);
		this.cacheStats = { hits: 0, misses: 0 };
		this.cache = new Map<Key, Entry>();
		this.gc = new GarbageCollector<Key>(key => {
			if (this.cache.delete(key)) {
				this.emit('expired', key);
			}
		});
	}

	protected guardMaxKeysNumber(): void {
		if (this.config.maxKeys !== INFINITE_KEYS && this.cache.size >= this.config.maxKeys) {
			throw createException(ErrorCodes.CACHE_FULL, `Limit of ${this.config.maxKeys} has been reached. `);
		}
	}

	protected guardNotTrackedByGC(key: Key, entry: BaseCacheEntry<Value>) {
		if (entry.trackedByGC) {
			throw createException(ErrorCodes.KEY_EXPIRATION_SET, `Key ${key} will expire on ${new Date(entry.expires)}. `);
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
