import sizeof from 'object-sizeof';
import { BaseLFUEvictionPolicy, EvictableKeyNode, FreqListNode } from './lfu-base';
import { SetOperationContext } from '../../contracts/replacement-policy';
import { CacheEntry } from '../../contracts/commons';

// see https://medium.com/@bparli/enhancing-least-frequently-used-caches-with-dynamic-aging-64dc973d5857

/**
 * Determine size of an object in Bytes. This object is the actual entry stored in the cache. <br/>
 * That entry contains key, value and other metadata. <br/>
 * While computing it's size, you are not allowed to alter it's values/structure.
 */
interface SizeOf<T> {
	(object: Readonly<T>): number;
}

/**
 * [Greedy Dual-Size with Frequency](https://www.hpl.hp.com/personal/Lucy_Cherkasova/projects/gdfs.html "Improving Web Servers and Proxies Performance with GDSF Caching Policies") eviction policy.
 * To be used carefully, as in practice, if no items are evicted, items frequency will increase with a very low rate.
 */
class GDSFEvictionPolicy<Key, Value> extends BaseLFUEvictionPolicy<Key, Value> {
	private readonly sizeOf: SizeOf<Value>;

	private cacheAge: number;

	/**
	 * @inheritDoc
	 */
	public constructor(capacity: number, sizeOfInBytes?: SizeOf<Value>) {
		super(capacity);
		this.sizeOf = sizeOfInBytes || sizeof;
		this.cacheAge = 0;
	}

	public onUpdate(_key: Key, _entry: CacheEntry<Value>, _context: SetOperationContext): void {
		throw new Error('NOT IMPLEMENTED! FREQUENCY NEEDS TO BE RECOMPUTED!');
	}

	/**
	 * @inheritDoc
	 */
	protected get initialFrequency(): number {
		// this is to preserver assumption that cacheAge is always less that or equal to lowest list frequency,
		// as if we take into account item size, then it's initial freq might go bellow cacheAge,
		// @fixme to be correct, we can take into account entry size, but we need to update cacheAge if it goes bellow it
		return this.cacheAge;
	}

	/**
	 * @inheritDoc
	 */
	protected computeEntryFrequency(entry: EvictableKeyNode<Key, Value>, entryScore: number): number {
		return Math.round((entryScore / this.sizeOf(entry.value)) * 10) / 10 + this.cacheAge + 1;
		// return Math.round(entryScore / this.sizeOf(entry.value)) + this.cacheAge + 1;
	}

	/**
	 * @inheritDoc
	 */
	protected onEvict(from: FreqListNode<Key, Value>): void {
		this.cacheAge = from.frequency;
	}
}

export { GDSFEvictionPolicy };