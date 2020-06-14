import { Seconds, Threshold } from '@thermopylae/core.declarations';
import { MemCache, MemCacheConfig } from './mem-cache';
import { SpeculativeExpirationPolicy } from '../expiration-policies/speculative-expiration-policy';
import { CacheEntry } from '../contracts/cache';
import { EvictionPolicy } from '../contracts/eviction-policy';

interface SpeculativeCacheOptions<Key, Value, Entry> extends MemCacheConfig<Key, Value, Entry> {
	checkInterval?: Seconds;
	iterateThreshold?: Threshold;
}

class SpeculativeCache<Key = string, Value = any, Entry extends CacheEntry<Value> = CacheEntry<Value>> extends MemCache<Key, Value, Entry> {
	private iterator: IterableIterator<[Key, CacheEntry<Value>]>;

	constructor(options: Partial<SpeculativeCacheOptions<Key, Value, Entry>> = {}, evictionPolicy?: EvictionPolicy<Key, Value, Entry>) {
		super(
			options,
			new SpeculativeExpirationPolicy<Key, Value>({
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
				collectionSize: () => this.cache.size,
				checkInterval: options.checkInterval,
				iterateThreshold: options.iterateThreshold
			}),
			evictionPolicy
		);

		this.iterator = this.cache[Symbol.iterator]();
	}
}

export { SpeculativeCache, SpeculativeCacheOptions };
