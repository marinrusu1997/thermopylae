import { UnixTimestamp } from '@thermopylae/core.declarations';

declare type EventType = 'set' | 'update' | 'del' | 'flush';
declare type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

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

declare interface CacheEntryFilter {
	notOlder: UnixTimestamp;
}

export { EventType, EventListener, CacheStats, CacheKey, CacheEntry };
