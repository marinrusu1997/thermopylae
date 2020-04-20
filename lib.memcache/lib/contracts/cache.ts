import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

interface CachedItem<Key, Value> {
	key: Key;
	value: Value;
}

interface CacheStats {
	hits: number;
	misses: number;
}

interface ExpirableCacheKey<Key = string> {
	key: Key;
	expiresAt: UnixTimestamp | null;
}

interface ExpirableCacheValue<Value> {
	value: Value;
	expiresAt: UnixTimestamp | null;
}

type EventType = 'set' | 'update' | 'del' | 'expired' | 'evicted' | 'flush';

type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

interface Cache<Key = string, Value = any> {
	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): this;

	upset(key: Key, value: Value, ttl: Seconds | null, from?: UnixTimestamp): this;

	get(key: Key): Value | undefined;
	mget(keys: Array<Key>): Array<CachedItem<Key, Value>>;

	take(key: Key): Value | undefined;

	del(key: Key): boolean;
	mdel(keys: Array<Key>): void;

	ttl(key: Key, ttl: Seconds, from?: UnixTimestamp): boolean;

	keys(): Array<Key>;

	has(key: Key): boolean;

	stats(): CacheStats;

	clear(): void;

	empty(): boolean;

	readonly size: number;

	on(event: EventType, listener: EventListener<Key, Value>): this;
}

const INFINITE_TTL = 0;

const INFINITE_KEYS = -1;

export { Cache, CachedItem, ExpirableCacheKey, ExpirableCacheValue, CacheStats, EventType, EventListener, INFINITE_TTL, INFINITE_KEYS };
