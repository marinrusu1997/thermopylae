import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { Cache, CachedItem, CacheStats, EventListener, EventType } from './cache';

declare interface AsyncCache<Key = string, Value = any> extends Cache<Key, Value> {
	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void>;

	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void>;

	get(key: Key): Promise<Value | undefined>;
	mget(keys: Array<Key>): Promise<Array<CachedItem<Key, Value>>>;

	take(key: Key): Promise<Value | undefined>;

	del(key: Key): Promise<boolean>;
	mdel(keys: Array<Key>): Promise<void>;

	ttl(key: Key, ttl: Seconds, from?: UnixTimestamp): boolean;

	keys(): Array<Key>;

	has(key: Key): boolean;

	stats(): CacheStats;

	clear(): Promise<void>;

	empty(): boolean;

	readonly size: number;

	on(event: EventType, listener: EventListener<Key, Value>): this;
}

export { AsyncCache };
