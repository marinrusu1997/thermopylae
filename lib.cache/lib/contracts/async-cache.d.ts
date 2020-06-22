import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { CachedItem, CacheStats, EventListener, EventType } from './cache';

declare interface AsyncCache<Key, Value> {
	get(key: Key): Promise<Value | undefined>;
	mget(keys: Array<Key>): Promise<Array<CachedItem<Key, Value>>>;

	set(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void>;
	upset(key: Key, value: Value, ttl?: Seconds, from?: UnixTimestamp): Promise<void>;

	take(key: Key): Promise<Value | undefined>;

	has(key: Key): Promise<boolean>;

	del(key: Key): Promise<boolean>;
	mdel(keys: Array<Key>): Promise<void>;

	ttl(key: Key, ttl: Seconds, from?: UnixTimestamp): Promise<boolean>;

	keys(): Promise<Array<Key>>;

	stats(): CacheStats;

	clear(): Promise<void>;

	empty(): Promise<boolean>;

	readonly size: Promise<number>;

	on(event: EventType, listener: EventListener<Key, Value>): this;
}

export { AsyncCache };
