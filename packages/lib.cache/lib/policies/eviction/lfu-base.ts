import { ErrorCodes, Threshold } from '@thermopylae/core.declarations';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey, CacheSizeGetter } from '../../contracts/commons';
import { createException } from '../../error';
import { BucketEntryNode, OrderedBucketList } from '../../data-structures/bucket-list/ordered-bucket-list';

const IGNORED_BUCKET_ID = -1;

/**
 * @private		Should not appear in public documentation.
 */
interface EvictableKeyNode<Key, Value> extends CacheEntry<Value>, CacheKey<Key>, BucketEntryNode<EvictableKeyNode<Key, Value>> {}

/**
 * Base class for LFU policies.
 */
abstract class BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	private readonly frequencies: OrderedBucketList<EvictableKeyNode<Key, Value>>;

	private readonly cacheMaxCapacity: number;

	private readonly cacheSizeGetter: CacheSizeGetter;

	private deleteFromCache!: Deleter<Key, Value>;

	/**
	 * @param cacheMaxCapacity	{@link Cache} maximum capacity.
	 * @param cacheSizeGetter	Getter for cache size.
	 */
	public constructor(cacheMaxCapacity: Threshold, cacheSizeGetter: CacheSizeGetter) {
		if (cacheMaxCapacity <= 0) {
			throw createException(ErrorCodes.INVALID_VALUE, `Capacity needs to be greater than 0. Given: ${cacheMaxCapacity}.`);
		}

		this.cacheMaxCapacity = cacheMaxCapacity;
		this.cacheSizeGetter = cacheSizeGetter;
		this.frequencies = new OrderedBucketList<EvictableKeyNode<Key, Value>>();
	}

	/**
	 * @returns		Total number of elements from frequency list.
	 */
	public get size(): number {
		return this.frequencies.size;
	}

	/**
	 * @inheritDoc
	 */
	public onGet(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		const oldFrequency = OrderedBucketList.getBucketId(entry);
		const newFrequency = this.computeEntryFrequency(entry, oldFrequency);

		this.frequencies.move(IGNORED_BUCKET_ID, newFrequency, entry);
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>): void {
		// Check for backend overflow
		if (this.cacheSizeGetter() > this.cacheMaxCapacity) {
			this.evict();
		}

		entry.key = key;
		this.frequencies.add(this.initialFrequency, entry);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(_key: Key, entry: EvictableKeyNode<Key, Value>): void {
		this.frequencies.remove(IGNORED_BUCKET_ID, entry);
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		this.frequencies.clear();
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private evict(): void {
		const currentFreqListHead = this.frequencies.head!;

		this.deleteFromCache(currentFreqListHead.bucket.tail!.key, currentFreqListHead.bucket.tail!);
		// removal from frequency list will be made by `onDelete` hook invoked by cache deleter

		// removal from frequency bucket might update `this.freqList` head, that's why we pass a copy of the head to this function
		// as it needs the node from where item was evicted
		this.onEvict(currentFreqListHead.id);
	}

	/**
	 * @returns 	Entry initial starting frequency.
	 */
	protected abstract get initialFrequency(): number;

	/**
	 * Delegate called before entry needs to be inserted in a frequency bucket. <br/>
	 * Entry will be inserted in the bucket that has frequency equal to result returned by this function.
	 *
	 * @param entry			Entry for which score needs to be computed.
	 * @param entryScore    Current score of the entry.
	 *
	 * @returns     New frequency of the entry.
	 */
	protected abstract computeEntryFrequency(entry: EvictableKeyNode<Key, Value>, entryScore: number): number;

	/**
	 * Delegate called after item has been evicted from cache.
	 *
	 * @param frequency		Frequency of the evicted item.
	 */
	protected abstract onEvict(frequency: number): void;
}

export { BaseLFUEvictionPolicy, EvictableKeyNode };
