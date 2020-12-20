import sizeof from 'object-sizeof';
import { BaseLFUEvictionPolicy, EvictableKeyNode, FreqListNode } from './lfu-base';
import { Deleter } from '../../contracts/cache-policy';

// see https://medium.com/@bparli/enhancing-least-frequently-used-caches-with-dynamic-aging-64dc973d5857

/**
 * Determine size of an object. This object is the actual entry stored in the cache. <br/>
 * That entry contains key, value and other metadata. <br/>
 * While computing it's size, you are not allowed to alter it's values/structure.
 */
interface SizeOf<T> {
	(object: Readonly<T>): number;
}

/**
 * [Greedy Dual-Size with Frequency](https://www.hpl.hp.com/personal/Lucy_Cherkasova/projects/gdfs.html "Improving Web Servers and Proxies Performance with GDSF Caching Policies") eviction policy.
 */
class GDSFEvictionPolicy<Key, Value> extends BaseLFUEvictionPolicy<Key, Value> {
	private readonly sizeOf: SizeOf<Value>;

	private cacheAge: number;

	/**
	 * @inheritDoc
	 */
	public constructor(capacity: number, bucketEvictCount?: number, deleter?: Deleter<Key>, sizeOf?: SizeOf<Value>) {
		super(capacity, bucketEvictCount, deleter);
		this.sizeOf = sizeOf || sizeof;
		this.cacheAge = 0;
	}

	/**
	 * @inheritDoc
	 */
	protected computeEntryFrequency(entry: EvictableKeyNode<Key, Value>, entryScore: number): number {
		return Math.floor(entryScore / this.sizeOf(entry.value)) + this.cacheAge + 1;
	}

	/**
	 * @inheritDoc
	 */
	protected onEvict(from: FreqListNode<Key, Value>): void {
		this.cacheAge = from.frequency;
	}
}

export { GDSFEvictionPolicy };
