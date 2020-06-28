import { Undefinable } from '@thermopylae/core.declarations';

declare interface CacheKey<Key> {
	key: Key;
}

declare interface CacheEntry<Value> {
	value: Value;
}

declare interface CacheBackend<Key, Value> {
	get(key: Key): Undefinable<CacheEntry<Value>>;
	set(key: Key, value: Value): CacheEntry<Value>;
	del(key: Key): boolean;
	clear(): void;
	keys(): Array<Key>;
	readonly size: number;
}

export { CacheKey, CacheEntry, CacheBackend };
