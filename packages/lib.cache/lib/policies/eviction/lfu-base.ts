import type { Threshold } from '@thermopylae/core.declarations';
import type { CacheBackendElementsCount } from '../../contracts/cache-backend.js';
import { type CacheReplacementPolicy, type Deleter, EntryValidity } from '../../contracts/cache-replacement-policy.js';
import type { CacheEntry } from '../../contracts/commons.js';
import { type BucketEntryNode, OrderedBucketList } from '../../data-structures/bucket-list/ordered-bucket-list.js';
import { ErrorCodes, createException } from '../../error.js';

/** @private */
const IGNORED_BUCKET_ID = -1;

/** @private */
interface EvictableCacheEntry<Key, Value> extends CacheEntry<Key, Value>, BucketEntryNode<EvictableCacheEntry<Key, Value>> {}

/**
 * Base class for LFU policies.
 *
 * @private
 *
 * @template Key Type of the key.
 * @template Value Type of the value.
 * @template ArgumentsBundle Type of the arguments bundle.
 */
abstract class BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	private readonly frequencies: OrderedBucketList<EvictableCacheEntry<Key, Value>>;

	private readonly cacheMaxCapacity: number;

	private readonly cacheBackendElementsCount: CacheBackendElementsCount;

	private deleteFromCache!: Deleter<Key, Value>;

	/**
	 * @param cacheMaxCapacity          {@link Cache} maximum capacity.
	 * @param cacheBackendElementsCount Cache backend elements count.
	 */
	public constructor(cacheMaxCapacity: Threshold, cacheBackendElementsCount: CacheBackendElementsCount) {
		if (cacheMaxCapacity <= 0) {
			throw createException(ErrorCodes.INVALID_CACHE_MAX_CAPACITY, `Capacity needs to be greater than 0. Given: ${cacheMaxCapacity}.`);
		}

		this.cacheMaxCapacity = cacheMaxCapacity;
		this.cacheBackendElementsCount = cacheBackendElementsCount;
		this.frequencies = new OrderedBucketList<EvictableCacheEntry<Key, Value>>();
	}

	/** @returns Total number of elements from frequency list. */
	public get size(): number {
		return this.frequencies.size;
	}

	/** @inheritDoc */
	public onHit(entry: EvictableCacheEntry<Key, Value>): EntryValidity {
		const oldFrequency = OrderedBucketList.getBucketId(entry);
		const newFrequency = this.computeEntryFrequency(entry, oldFrequency);

		this.frequencies.move(IGNORED_BUCKET_ID, newFrequency, entry);
		return EntryValidity.VALID;
	}

	/** @inheritDoc */
	public onMiss(): void {
		return undefined;
	}

	/** @inheritDoc */
	public onSet(entry: EvictableCacheEntry<Key, Value>): void {
		// Check for backend overflow
		if (this.cacheBackendElementsCount.size > this.cacheMaxCapacity) {
			this.evict();
		}

		this.frequencies.add(this.initialFrequency, entry);
	}

	/** @inheritDoc */
	public onUpdate(_entry: EvictableCacheEntry<Key, Value>): void {
		return undefined;
	}

	/** @inheritDoc */
	public onDelete(entry: EvictableCacheEntry<Key, Value>): void {
		this.frequencies.remove(IGNORED_BUCKET_ID, entry);
	}

	/** @inheritDoc */
	public onClear(): void {
		this.frequencies.clear();
	}

	/** @inheritDoc */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private evict(): void {
		const currentFreqListHead = this.frequencies.head!;

		this.deleteFromCache(currentFreqListHead.bucket.tail!);
		// removal from frequency list will be made by `onDelete` hook invoked by cache deleter

		// removal from frequency bucket might update `this.freqList` head, that's why we pass a copy of the head to this function
		// as it needs the node from where item was evicted
		this.onEvict(currentFreqListHead.id);
	}

	/** @returns Entry initial starting frequency. */
	protected abstract get initialFrequency(): number;

	/**
	 * Delegate called before entry needs to be inserted in a frequency bucket. <br/> Entry will be
	 * inserted in the bucket that has frequency equal to result returned by this function.
	 *
	 * @param   entry      Entry for which score needs to be computed.
	 * @param   entryScore Current score of the entry.
	 *
	 * @returns            New frequency of the entry.
	 */
	protected abstract computeEntryFrequency(entry: EvictableCacheEntry<Key, Value>, entryScore: number): number;

	/**
	 * Delegate called after item has been evicted from cache.
	 *
	 * @param frequency Frequency of the evicted item.
	 */
	protected abstract onEvict(frequency: number): void;
}

export { BaseLFUEvictionPolicy, type EvictableCacheEntry };
