import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheFrontend, CachedItem, EventListener, EventType } from '../contracts/sync/cache-frontend';
import { AsyncCache } from '../contracts/async/async-cache';
import { CacheStats } from '../contracts/sync/cache-middleend';

function convert<K, V>(cache: CacheFrontend<K, V>): AsyncCache<K, V> {
	return {
		set(key: K, value: V, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
			try {
				cache.set(key, value, ttl, from);
				return Promise.resolve();
			} catch (e) {
				return Promise.reject(e);
			}
		},

		upset(key: K, value: V, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
			try {
				cache.upset(key, value, ttl, from);
				return Promise.resolve();
			} catch (e) {
				return Promise.reject(e);
			}
		},

		get(key: K): Promise<V | undefined> {
			try {
				return Promise.resolve(cache.get(key));
			} catch (e) {
				return Promise.reject(e);
			}
		},

		mget(keys: Array<K>): Promise<Array<CachedItem<K, V>>> {
			try {
				return Promise.resolve(cache.mget(keys));
			} catch (e) {
				return Promise.reject(e);
			}
		},

		take(key: K): Promise<V | undefined> {
			try {
				return Promise.resolve(cache.take(key));
			} catch (e) {
				return Promise.reject(e);
			}
		},

		has(key: K): Promise<boolean> {
			try {
				return Promise.resolve(cache.has(key));
			} catch (e) {
				return Promise.reject(e);
			}
		},

		del(key: K): Promise<boolean> {
			try {
				return Promise.resolve(cache.del(key));
			} catch (e) {
				return Promise.reject(e);
			}
		},

		mdel(keys: Array<K>): Promise<void> {
			try {
				return Promise.resolve(cache.mdel(keys));
			} catch (e) {
				return Promise.reject(e);
			}
		},

		ttl(key: K, ttl: Seconds, from?: UnixTimestamp): Promise<boolean> {
			try {
				return Promise.resolve(cache.ttl(key, ttl, from));
			} catch (e) {
				return Promise.reject(e);
			}
		},

		keys(): Promise<Array<K>> {
			try {
				return Promise.resolve(cache.keys());
			} catch (e) {
				return Promise.reject(e);
			}
		},

		stats(): CacheStats {
			return cache.stats();
		},

		clear(): Promise<void> {
			try {
				return Promise.resolve(cache.clear());
			} catch (e) {
				return Promise.reject(e);
			}
		},

		empty(): Promise<boolean> {
			try {
				return Promise.resolve(cache.empty());
			} catch (e) {
				return Promise.reject(e);
			}
		},

		get size(): Promise<number> {
			try {
				return Promise.resolve(cache.size);
			} catch (e) {
				return Promise.reject(e);
			}
		},

		on(event: EventType, listener: EventListener<K, V>): AsyncCache<K, V> {
			cache.on(event, listener);
			return this;
		}
	};
}

class Converter {
	public static toAsync<K, V>(cache: CacheFrontend<K, V>): AsyncCache<K, V> {
		return convert(cache);
	}
}

export { Converter };
