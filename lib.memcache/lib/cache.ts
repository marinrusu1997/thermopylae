import { Seconds } from '@thermopylae/core.declarations';

interface CachedItem<Key, Value> {
	key: Key;
	value: Value;
}

interface CacheStats {
	hits: number;
	misses: number;
}

type EventType = 'set' | 'update' | 'del' | 'expired' | 'evicted' | 'flush';

type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

interface Cache<Key = string, Value = any> {
	set(key: Key, value: Value, ttl?: Seconds): this;

	upset(key: Key, value: Value, ttl?: Seconds): this;

	get(key: Key): Value | undefined;
	mget(keys: Array<Key>): Array<CachedItem<Key, Value>>;

	take(key: Key): Value | undefined;

	del(key: Key): boolean;
	mdel(keys: Array<Key>): void;

	ttl(key: Key, ttl?: Seconds): boolean;

	keys(): Array<Key>;

	has(key: Key): boolean;

	stats(): CacheStats;

	clear(): void;

	on(event: EventType, listener: EventListener<Key, Value>): this;
}

const INFINITE_TTL = 0;

const INFINITE_KEYS = -1;

export { Cache, CachedItem, CacheStats, EventType, EventListener, INFINITE_TTL, INFINITE_KEYS };
