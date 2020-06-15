import { MemCache, MemCacheConfig } from './mem-cache';
import { AutoExpirationPolicy } from '../expiration-policies/auto-expiration-policy';
import { createException, ErrorCodes } from '../error';
import { CacheEntry } from '../contracts/cache';
import { EvictionPolicy } from '../contracts/eviction-policy';

class AutoExpirableCache<Key = string, Value = any, Entry extends CacheEntry<Value> = CacheEntry<Value>> extends MemCache<Key, Value, Entry> {
	constructor(config?: Partial<MemCacheConfig<Key, Value, Entry>>, evictionPolicy?: EvictionPolicy<Key, Value, Entry>) {
		super(config, new AutoExpirationPolicy<Key, Value, Entry>(), evictionPolicy);
	}

	public set(key: Key): this {
		throw createException(
			ErrorCodes.OPERATION_NOT_SUPPORTED,
			`Setting ${key} is not supported. Explanation:\n` +
				'Entries in the expire keys heap are not unique.\n' +
				'It is possible to have multiple entries with the same key, which might have different expiration timestamps.\n' +
				'These entries will act like zombies, causing unwanted deletions in the future of valid entries.\n' +
				"Therefore it's very important to have a single entry with the key which has the same ttl as the one from cache.\n" +
				'You are highly encouraged to methods which checks if entry exists already and updates it, rather that overwrite and add new entries into heap.'
		);
	}
}

export { AutoExpirableCache };
