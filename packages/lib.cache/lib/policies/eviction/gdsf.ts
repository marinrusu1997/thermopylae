import sizeof from 'object-sizeof';
import { BaseLFUEvictionPolicy, EvictableKeyNode } from './lfu-base';
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

class GDSFEvictionPolicy<Key, Value> extends BaseLFUEvictionPolicy<Key, Value> {
	private readonly sizeOf: SizeOf<EvictableKeyNode<Key, Value>>;

	/**
	 * @inheritDoc
	 */
	public constructor(capacity: number, bucketEvictCount?: number, deleter?: Deleter<Key>, sizeOf?: SizeOf<EvictableKeyNode<Key, Value>>) {
		super(capacity, bucketEvictCount, deleter);
		this.sizeOf = sizeOf || sizeof;
	}

	protected get cacheAge(): number {
		return this.freqList.head != null ? this.freqList.head.frequency : 0; // cache is empty, so it's age is 0
	}

	/**
	 * @inheritDoc
	 */
	protected computeEntryFrequency(entry: EvictableKeyNode<Key, Value>, entryScore: number): number {
		return entryScore / this.sizeOf(entry) + this.cacheAge + 1;
	}
}

export { GDSFEvictionPolicy };
