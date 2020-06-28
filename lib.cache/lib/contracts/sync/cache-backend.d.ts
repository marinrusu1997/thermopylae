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
	del(key: Key, entry: boolean): boolean | Undefinable<CacheEntry<Value>>;
	keys(): IterableIterator<Key>;
	clear(): void;

	[Symbol.iterator](): IterableIterator<[Key, CacheEntry<Value>]>;

	readonly size: number;
}

export { CacheKey, CacheEntry, CacheBackend };
