import sizeof from 'object-sizeof';
import { Threshold } from '@thermopylae/core.declarations';
import { BaseLFUEvictionPolicy, EvictableKeyNode } from './lfu-base';
import { CacheBackendElementsCount } from '../../contracts/cache-backend';

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
 * **To be used carefully, as in practice, if no items are evicted, items frequency will increase with a very low rate.**
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class GDSFEvictionPolicy<Key, Value, ArgumentsBundle> extends BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> {
	private readonly sizeOf: SizeOf<Value>;

	private cacheAge: number;

	/**
	 * @param cacheMaxCapacity				{@link Cache} maximum capacity.
	 * @param cacheBackendElementsCount		Cache backend elements count.
	 * @param sizeOfInBytes					Function which computes sizeof cache entry in bytes.
	 */
	public constructor(cacheMaxCapacity: Threshold, cacheBackendElementsCount: CacheBackendElementsCount, sizeOfInBytes?: SizeOf<Value>) {
		super(cacheMaxCapacity, cacheBackendElementsCount);
		this.sizeOf = sizeOfInBytes || sizeof;
		this.cacheAge = 0;
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(key: Key, entry: EvictableKeyNode<Key, Value>): void {
		this.onGet(key, entry); // onGet performs the required actions: recomputes frequency and moves to another bucket
	}

	/**
	 * @inheritDoc
	 */
	protected get initialFrequency(): number {
		// this is to preserve assumption that cacheAge is always less that or equal to lowest list frequency,
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
	protected onEvict(frequencyOfTheEvictedEntry: number): void {
		this.cacheAge = frequencyOfTheEvictedEntry;
	}
}

export { GDSFEvictionPolicy };
