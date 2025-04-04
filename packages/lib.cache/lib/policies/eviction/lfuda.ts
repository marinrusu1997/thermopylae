import type { Threshold } from '@thermopylae/core.declarations';
import type { CacheBackendElementsCount } from '../../contracts/cache-backend.js';
import { BaseLFUEvictionPolicy, type EvictableCacheEntry } from './lfu-base.js';

// see https://medium.com/@bparli/enhancing-least-frequently-used-caches-with-dynamic-aging-64dc973d5857

/**
 * [Least Frequently Used with Dynamic
 * Aging](https://en.wikipedia.org/wiki/Cache_replacement_policies#LFU_with_dynamic_aging_(LFUDA))
 * eviction policy.
 *
 * @template Key Type of the key.
 * @template Value Type of the value.
 * @template ArgumentsBundle Type of the arguments bundle.
 */
class LFUDAEvictionPolicy<Key, Value, ArgumentsBundle> extends BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> {
	private cacheAge: number;

	/**
	 * @param cacheMaxCapacity          {@link Cache} maximum capacity.
	 * @param cacheBackendElementsCount Cache backend elements count.
	 */
	public constructor(cacheMaxCapacity: Threshold, cacheBackendElementsCount: CacheBackendElementsCount) {
		super(cacheMaxCapacity, cacheBackendElementsCount);
		this.cacheAge = 0;
	}

	/** @inheritDoc */
	protected get initialFrequency(): number {
		return this.cacheAge;
	}

	/** @inheritDoc */
	protected computeEntryFrequency(_entry: EvictableCacheEntry<Key, Value>, entryScore: number): number {
		return entryScore + this.cacheAge + 1;
	}

	/** @inheritDoc */
	protected onEvict(frequencyOfTheEvictedEntry: number): void {
		this.cacheAge = frequencyOfTheEvictedEntry;
	}
}

export { LFUDAEvictionPolicy };
