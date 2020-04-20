import { BaseCacheEntry } from './caches/base-cache';

declare type Deleter<Key = string> = (key: Key) => void;

declare interface EvictionPolicy<Key = string, Value = any, Entry extends BaseCacheEntry<Value> = BaseCacheEntry<Value>> {
	wrapEntry(key: Key, entry: Entry): Entry;
	accessed(key: Key): void;
	evict(): boolean;
	setDeleter(deleter: Deleter<Key>): void;
}

export { EvictionPolicy, Deleter };
