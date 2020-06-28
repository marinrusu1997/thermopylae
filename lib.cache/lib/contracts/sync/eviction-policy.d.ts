import { CachePolicy } from './cache-policy';
import { CacheEntry } from './cache-backend';

declare interface EvictionPolicy<Key, Value> extends CachePolicy<Key, Value> {
	onSet(key: Key, entry: CacheEntry<Value>, size: number): void;
	onGet(key: Key, entry: CacheEntry<Value>): void;
}

export { EvictionPolicy };
