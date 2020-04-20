import { Seconds, Threshold } from '@thermopylae/core.declarations';
import { BaseCache, BaseCacheConfig } from './base-cache';
import { SpeculativeExpirationPolicy } from '../expiration-policies/speculative-expiration-policy';
import { ExpirableCacheValue } from '../contracts/cache';
import { EvictionPolicy } from '../contracts/eviction-policy';

interface SpeculativeCacheOptions extends BaseCacheConfig {
	checkPeriod?: Seconds;
	iterateThreshold?: Threshold;
}

class SpeculativeCache<Key = string, Value = any, Entry extends ExpirableCacheValue<Value> = ExpirableCacheValue<Value>> extends BaseCache<Key, Value, Entry> {
	private iterator: IterableIterator<[Key, ExpirableCacheValue<Value>]>;

	constructor(options: Partial<SpeculativeCacheOptions> = {}, evictionPolicy?: EvictionPolicy<Key, Value, Entry>) {
		super(
			options,
			new SpeculativeExpirationPolicy<Key>({
				nextCacheKey: () => {
					const entry = this.iterator.next();

					if (entry.done) {
						this.iterator = this.cache[Symbol.iterator](); // reposition to beginning
						return null;
					}

					return { key: entry.value[0], expiresAt: entry.value[1].expiresAt };
				},
				collectionSize: () => this.cache.size,
				checkInterval: options.checkPeriod,
				iterateThreshold: options.iterateThreshold
			}),
			evictionPolicy
		);

		this.iterator = this.cache[Symbol.iterator]();
	}
}

export { SpeculativeCache, SpeculativeCacheOptions };
