declare type EventType = 'set' | 'update' | 'del' | 'flush';
declare type EventListener<Key, Value> = (key?: Key, value?: Value) => void;

declare interface CacheStats {
	hits: number;
	misses: number;
}

export { EventType, EventListener, CacheStats };
