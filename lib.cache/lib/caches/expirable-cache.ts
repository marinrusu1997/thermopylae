import { Seconds, Threshold } from '@thermopylae/core.declarations';
import { MemCache, MemCacheConfig } from './mem-cache';
import { IterativeExpirationPolicy } from '../expiration-policies/iterative-expiration-policy';
import { CacheEntry } from '../contracts/cache';
import { EvictionPolicy } from '../contracts/eviction-policy';

interface ExpirableCacheOptions<Key, Value, Entry> extends MemCacheConfig<Key, Value, Entry> {
	checkInterval?: Seconds;
	iterateThreshold?: Threshold;
}

class ExpirableCache<Key = string, Value = any, Entry extends CacheEntry<Value> = CacheEntry<Value>> extends MemCache<Key, Value, Entry> {
	private iterator: IterableIterator<[Key, CacheEntry<Value>]>;

	constructor(options: Partial<ExpirableCacheOptions<Key, Value, Entry>> = {}, evictionPolicy?: EvictionPolicy<Key, Value, Entry>) {
		super(
			options,
			new IterativeExpirationPolicy<Key, Value>({
				nextCacheKey: () => {
					const entry = this.iterator.next();

					if (entry.done) {
						this.iterator = this.cache[Symbol.iterator](); // reposition to beginning
						return null;
					}

					// FIXME major encapsulation breaking
					// @ts-ignore
					const { expiresAt } = entry.value[1];

					return { key: entry.value[0], expiresAt };
				},
				collectionSize: (): number => this.cache.size,
				checkInterval: options.checkInterval,
				iterateThreshold: options.iterateThreshold
			}),
			evictionPolicy
		);

		this.iterator = this.cache[Symbol.iterator]();
	}
}

export { ExpirableCache, ExpirableCacheOptions };
