import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { CacheEntry } from './cache';
import { CachePolicy } from './cache-policy';

interface ExpirableCacheEntry<Value> extends CacheEntry<Value> {
	expiresAt?: UnixTimestamp;
}

declare interface ExpirationPolicy<Key, Value, Entry extends CacheEntry<Value>> extends CachePolicy<Key, Value, Entry> {
	onSet(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void;
	onUpdate(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void;
	removeIfExpired(key: Key, entry: Entry): boolean;
}

export { ExpirationPolicy, ExpirableCacheEntry };
