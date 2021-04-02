import { Threshold } from '@thermopylae/core.declarations';
import { BaseLFUEvictionPolicy, EvictableKeyNode } from './lfu-base';
import { CacheBackendElementsCount } from '../../contracts/cache-backend';

// see https://medium.com/@bparli/enhancing-least-frequently-used-caches-with-dynamic-aging-64dc973d5857

/**
 * [Least Frequently Used with Dynamic Aging](https://en.wikipedia.org/wiki/Cache_replacement_policies#LFU_with_dynamic_aging_(LFUDA) "LFU with dynamic aging (LFUDA)") eviction policy.
 */
class LFUDAEvictionPolicy<Key, Value, ArgumentsBundle> extends BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> {
	private cacheAge: number;

	/**
	 * @param cacheMaxCapacity				{@link Cache} maximum capacity.
	 * @param cacheBackendElementsCount		Cache backend elements count.
	 */
	public constructor(cacheMaxCapacity: Threshold, cacheBackendElementsCount: CacheBackendElementsCount) {
		super(cacheMaxCapacity, cacheBackendElementsCount);
		this.cacheAge = 0;
	}

	/**
	 * @inheritDoc
	 */
	protected get initialFrequency(): number {
		return this.cacheAge;
	}

	/**
	 * @inheritDoc
	 */
	protected computeEntryFrequency(_entry: EvictableKeyNode<Key, Value>, entryScore: number): number {
		return entryScore + this.cacheAge + 1;
	}

	/**
	 * @inheritDoc
	 */
	protected onEvict(frequencyOfTheEvictedEntry: number): void {
		this.cacheAge = frequencyOfTheEvictedEntry;
	}
}

export { LFUDAEvictionPolicy };
