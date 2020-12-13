import { GDSFEvictionPolicy } from './gdsf';
import { Deleter } from '../../contracts/cache-policy';

// see https://medium.com/@bparli/enhancing-least-frequently-used-caches-with-dynamic-aging-64dc973d5857

/**
 * [Least Frequently Used with Dynamic Aging](https://en.wikipedia.org/wiki/Cache_replacement_policies#LFU_with_dynamic_aging_(LFUDA) "LFU with dynamic aging (LFUDA)") eviction policy.
 */
class LFUDAEvictionPolicy<Key, Value> extends GDSFEvictionPolicy<Key, Value> {
	/**
	 * @inheritDoc
	 */
	public constructor(capacity: number, bucketEvictCount?: number, deleter?: Deleter<Key>) {
		super(capacity, bucketEvictCount, deleter, () => 1);
	}
}

export { LFUDAEvictionPolicy };
