import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { CachePolicy } from './cache-policy';
import { CacheEntry } from './cache-backend';

interface ExpirableCacheEntry<Value> extends CacheEntry<Value> {
	expiresAt?: UnixTimestamp;
}

declare interface ExpirationPolicy<Key, Value> extends CachePolicy<Key, Value> {
	onSet(key: Key, entry: CacheEntry<Value>, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void;
	onUpdate(key: Key, entry: CacheEntry<Value>, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void;
	removeIfExpired(key: Key, entry: CacheEntry<Value>): boolean;
}

export { ExpirationPolicy, ExpirableCacheEntry };
