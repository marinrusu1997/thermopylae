import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

declare interface CacheStats {
	hits: number;
	misses: number;
}

declare interface CacheMiddleEnd<Key, Value> {
	get(key: Key): Value;
	set(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): void;
	replace(key: Key, value: Value, ttl?: Seconds, expiresFrom?: UnixTimestamp): boolean;
	ttl(key: Key, ttl: Seconds, expiresFrom?: UnixTimestamp): boolean;
	del(key: Key): boolean;
	keys(): Array<Key>;
	clear(): void;

	readonly size: number;
	readonly stats: CacheStats;
}

export { CacheMiddleEnd, CacheStats };
