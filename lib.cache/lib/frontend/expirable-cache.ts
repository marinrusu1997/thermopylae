import { Seconds, Threshold } from '@thermopylae/core.declarations';
import { MemCache, MemCacheOptions } from './mem-cache';
import { IterativeExpirationPolicy } from '../middleend/expiration-policies';
import { EvictionPolicy } from '../contracts/sync/eviction-policy';
import { CacheEntry } from '../contracts/sync/cache-backend';

interface ExpirableCacheOptions<Key, Value, Entry> extends MemCacheOptions<Key, Value, Entry> {
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
						this.iterator = this.middleend[Symbol.iterator](); // reposition to beginning
						return null;
					}

					// FIXME major encapsulation breaking
					// @ts-ignore
					const { expiresAt } = entry.value[1];

					return { key: entry.value[0], expiresAt };
				},
				collectionSize: (): number => this.middleend.size,
				checkInterval: options.checkInterval,
				iterateThreshold: options.iterateThreshold
			}),
			evictionPolicy
		);

		this.iterator = this.middleend[Symbol.iterator]();
	}
}

export { ExpirableCache, ExpirableCacheOptions };
