import { BaseCacheEntry } from '../caches/base-cache';

declare type Deleter<Key = string> = (key: Key) => void;

declare interface EvictionPolicy<Key = string, Value = any, Entry extends BaseCacheEntry<Value> = BaseCacheEntry<Value>> {
	onSet(key: Key, entry: Entry, size: number): Entry;
	onGet(key: Key, entry: Entry): void;
	onDelete(key: Key): void;
	onClear(): void;

	setDeleter(deleter: Deleter<Key>): void;
}

export { EvictionPolicy, Deleter };
