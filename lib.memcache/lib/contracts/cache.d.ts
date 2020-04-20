import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

declare interface CachedItem<Key, Value> {
	key: Key;
	value: Value;
}

declare interface CacheStats {
	hits: number;
	misses: number;
}

declare interface ExpirableCacheKey<Key = string> {
	key: Key;
	expiresAt: UnixTimestamp | null;
}

declare interface ExpirableCacheValue<Value> {
	value: Value;
	expiresAt: UnixTimestamp | null;
}

declare type EventType = 'set' | 'update' | 'del' | 'expired' | 'evicted' | 'flush';

declare type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

declare interface Cache<Key = string, Value = any> {
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

export { Cache, CachedItem, ExpirableCacheKey, ExpirableCacheValue, CacheStats, EventType, EventListener };
