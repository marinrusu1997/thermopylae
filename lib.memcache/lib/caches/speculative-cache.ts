import { Seconds, Threshold } from '@thermopylae/core.declarations';
import { BaseCache, BaseCacheConfig, BaseCacheEntry } from './base-cache';
import { NoEvictionPolicy } from '../eviction-policies/no-eviction-policy';
import { SpeculativeExpirationPolicy } from '../expiration-policies/speculative-expiration-policy';

interface SpeculativeCacheOptions extends BaseCacheConfig {
	checkPeriod?: Seconds;
	iterateThreshold?: Threshold;
}

class SpeculativeCache<Key = string, Value = any> extends BaseCache<Key, Value> {
	private iterator: IterableIterator<[Key, BaseCacheEntry<Value>]>;

	constructor(options: Partial<SpeculativeCacheOptions> = {}, evictionPolicy = new NoEvictionPolicy()) {
		super(
			options,
			new SpeculativeExpirationPolicy<Key>({
				nextCacheEntry: () => {
					const entry = this.iterator.next();

					if (entry.done) {
						this.iterator = this.cache[Symbol.iterator](); // reposition to beginning
						return null;
					}

					return { key: entry.value[0], expires: entry.value[1].expires };
				},
				collectionSize: () => this.size,
				checkPeriod: options.checkPeriod,
				iterateThreshold: options.iterateThreshold
			}),
			evictionPolicy
		);

		this.iterator = this.cache[Symbol.iterator]();
	}
}

export { SpeculativeCache };
