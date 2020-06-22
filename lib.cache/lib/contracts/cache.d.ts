import { Label, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

declare interface CacheStats {
	hits: number;
	misses: number;
}

declare interface CacheKey<Key> {
	key: Key;
}

declare interface CacheEntry<Value> {
	value: Value;
}

declare type EventType = 'set' | 'update' | 'del' | 'expired' | 'evicted' | 'flush';

declare type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

declare interface Cache<Key, Value> {
	readonly name: Label;

	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): this;

	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): this;

	get(key: Key): Value | undefined;
	mget(keys: Array<Key>): Map<Key, Value>;

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

export { Cache, CacheKey, CacheEntry, CacheStats, EventType, EventListener };
