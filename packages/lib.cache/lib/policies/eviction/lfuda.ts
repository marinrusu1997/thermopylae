import { BaseLFUEvictionPolicy, EvictableKeyNode, FreqListNode } from './lfu-base';

// see https://medium.com/@bparli/enhancing-least-frequently-used-caches-with-dynamic-aging-64dc973d5857

/**
 * [Least Frequently Used with Dynamic Aging](https://en.wikipedia.org/wiki/Cache_replacement_policies#LFU_with_dynamic_aging_(LFUDA) "LFU with dynamic aging (LFUDA)") eviction policy.
 */
class LFUDAEvictionPolicy<Key, Value> extends BaseLFUEvictionPolicy<Key, Value> {
	private cacheAge: number;

	/**
	 * @inheritDoc
	 */
	public constructor(capacity: number) {
		super(capacity);
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
	protected onEvict(from: FreqListNode<Key, Value>): void {
		this.cacheAge = from.frequency;
	}
}

export { LFUDAEvictionPolicy };
