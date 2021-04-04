import { Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode } from '../../data-structures/list/doubly-linked';
import { CacheReplacementPolicy, EntryValidity, Deleter } from '../../contracts/cache-replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { LinkedList } from '../../data-structures/list/interface';
import { createException, ErrorCodes } from '../../error';
import { CacheBackendElementsCount } from '../../contracts/cache-backend';

/**
 * @internal
 */
interface EvictableKeyNode<Key, Value> extends CacheEntry<Value>, CacheKey<Key>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {}

/**
 * [Least Recently Used](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU) "Least recently used (LRU)") eviction policy.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class LRUEvictionPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	private readonly cacheMaxCapacity: Threshold;

	private readonly cacheBackendElementsCount: CacheBackendElementsCount;

	private deleteFromCache!: Deleter<Key, Value>;

	private usageRecency: LinkedList<EvictableKeyNode<Key, Value>>;

	/**
	 * @param cacheMaxCapacity				{@link Cache} maximum capacity.
	 * @param cacheBackendElementsCount		Cache backend elements count.
	 */
	public constructor(cacheMaxCapacity: number, cacheBackendElementsCount: CacheBackendElementsCount) {
		if (cacheMaxCapacity <= 0) {
			throw createException(ErrorCodes.INVALID_VALUE, `Capacity needs to be greater than 0. Given: ${cacheMaxCapacity}.`);
		}

		this.cacheMaxCapacity = cacheMaxCapacity;
		this.cacheBackendElementsCount = cacheBackendElementsCount;
		this.usageRecency = new DoublyLinkedList<EvictableKeyNode<Key, Value>>();
	}

	/**
	 * @inheritDoc
	 */
	public onGet(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		this.usageRecency.toFront(entry);
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>): void {
		if (this.cacheBackendElementsCount.size > this.cacheMaxCapacity) {
			this.deleteFromCache(this.usageRecency.tail!.key, this.usageRecency.tail!); // removal from list will be made by `onDelete` hook
		}

		entry.key = key;
		this.usageRecency.unshift(entry);
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
		this.usageRecency.remove(entry);
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		this.usageRecency.clear();
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}
}

export { LRUEvictionPolicy, EvictableKeyNode };
