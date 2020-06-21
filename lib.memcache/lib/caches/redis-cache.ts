import { RedisClient } from 'redis';
import { AsyncCache } from '../contracts/async-cache';

interface RedisCacheOptions<K, V> {
	client: RedisClient;
}

class RedisCache<Key = string, Value = any> implements AsyncCache<Key, Value> {
	readonly size: Promise<number>;

	clear(): Promise<void> {
		return Promise.resolve(undefined);
	}

	del(key: Key): Promise<boolean> {
		return Promise.resolve(false);
	}

	empty(): Promise<boolean> {
		return Promise.resolve(false);
	}

	get(key: Key): Promise<Value | undefined> {
		return Promise.resolve(undefined);
	}

	has(key: Key): Promise<boolean> {
		return Promise.resolve(false);
	}

	keys(): Promise<Array<Key>> {
		return Promise.resolve(undefined);
	}

	mdel(keys: Array<Key>): Promise<void> {
		return Promise.resolve(undefined);
	}

	mget(keys: Array<Key>): Promise<Array<CachedItem<Key, Value>>> {
		return Promise.resolve(undefined);
	}

	on(event: EventType, listener: EventListener<Key, Value>): this {
		return undefined;
	}

	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
		return Promise.resolve(undefined);
	}

	stats(): CacheStats {
		return undefined;
	}

	take(key: Key): Promise<Value | undefined> {
		return Promise.resolve(undefined);
	}

	ttl(key: Key, ttl: Seconds, from?: UnixTimestamp): Promise<boolean> {
		return Promise.resolve(false);
	}

	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void> {
		return Promise.resolve(undefined);
	}
}

export { RedisCache };
