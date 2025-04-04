import { type Threshold, ThresholdC } from '@thermopylae/core.declarations';
import { DoublyLinkedList, type DoublyLinkedListNode } from '../../data-structures/list/doubly-linked.js';
import type { LinkedList } from '../../data-structures/list/interface.js';
import { ErrorCodes, createException } from '../../error.js';
import type { CacheBackendElementsCount } from '../../typings/cache-backend.js';
import { type CacheReplacementPolicy, type Deleter, EntryValidity } from '../../typings/cache-replacement-policy.js';
import type { CacheEntry } from '../../typings/commons.js';

/** @private */
interface EvictableCacheEntry<Key, Value> extends CacheEntry<Key, Value>, DoublyLinkedListNode<EvictableCacheEntry<Key, Value>> {}

/**
 * [Least Recently
 * Used](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))
 * eviction policy.
 *
 * @template Key Type of the key.
 * @template Value Type of the value.
 * @template ArgumentsBundle Type of the arguments bundle.
 */
class LRUEvictionPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	private readonly cacheMaxCapacity: Threshold;

	private readonly cacheBackendElementsCount: CacheBackendElementsCount;

	private deleteFromCache!: Deleter<Key, Value>;

	private readonly usageRecency: LinkedList<EvictableCacheEntry<Key, Value>>;

	/**
	 * @param cacheMaxCapacity          {@link Cache} maximum capacity.
	 * @param cacheBackendElementsCount Cache backend elements count.
	 * @param usageRecency              Usage recency list.
	 */
	public constructor(
		cacheMaxCapacity: number,
		cacheBackendElementsCount: CacheBackendElementsCount,
		usageRecency?: LinkedList<EvictableCacheEntry<Key, Value>>
	) {
		if (cacheMaxCapacity <= 0) {
			throw createException(ErrorCodes.INVALID_CACHE_MAX_CAPACITY, `Capacity needs to be greater than 0. Given: ${cacheMaxCapacity}.`);
		}

		this.cacheMaxCapacity = ThresholdC(cacheMaxCapacity);
		this.cacheBackendElementsCount = cacheBackendElementsCount;
		this.usageRecency = usageRecency ?? new DoublyLinkedList<EvictableCacheEntry<Key, Value>>();
	}

	/** @inheritdoc */
	public onHit(entry: EvictableCacheEntry<Key, Value>): EntryValidity {
		this.usageRecency.toFront(entry);
		return EntryValidity.VALID;
	}

	/** @inheritdoc */
	public onMiss(): void {
		return undefined;
	}

	/** @inheritdoc */
	public onSet(entry: EvictableCacheEntry<Key, Value>): void {
		if (this.cacheBackendElementsCount.size > this.cacheMaxCapacity && this.usageRecency.tail) {
			this.deleteFromCache(this.usageRecency.tail); // removal from list will be made by `onDelete` hook
		}

		this.usageRecency.unshift(entry);
	}

	/** @inheritdoc */
	public onUpdate(): void {
		return undefined;
	}

	/** @inheritdoc */
	public onDelete(entry: EvictableCacheEntry<Key, Value>): void {
		this.usageRecency.remove(entry);
	}

	/** @inheritdoc */
	public onClear(): void {
		this.usageRecency.clear();
	}

	/** @inheritdoc */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}
}

export { LRUEvictionPolicy, type EvictableCacheEntry };
