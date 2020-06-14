import { CachePolicy } from './cache-policy';
import { CacheEntry } from './cache';

declare interface EvictionPolicy<Key, Value, Entry extends CacheEntry<Value> = CacheEntry<Value>> extends CachePolicy<Key, Value, Entry> {
	onSet(key: Key, entry: Entry, size: number): void;
	onGet(key: Key, entry: Entry): void;
}

export { EvictionPolicy };
