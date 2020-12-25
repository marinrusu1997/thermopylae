import { Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode } from '../../helpers/doubly-linked-list';
import { CacheReplacementPolicy, EntryValidity, SetOperationContext, Deleter } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { LinkedList } from '../../contracts/linked-list';
import { createException, ErrorCodes } from '../../error';

/**
 * @private		Should not appear in public documentation.
 */
interface EvictableKeyNode<Key, Value> extends CacheEntry<Value>, CacheKey<Key>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {}

/**
 * [Least Recently Used](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU) "Least recently used (LRU)") eviction policy.
 */
class LRUEvictionPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	private readonly cacheCapacity: Threshold;

	private deleteFromCache!: Deleter<Key>;

	private usageRecency: LinkedList<EvictableKeyNode<Key, Value>>;

	/**
	 * @param capacity	{@link Cache} maximum capacity.
	 */
	public constructor(capacity: Threshold) {
		if (capacity <= 0) {
			throw createException(ErrorCodes.INVALID_VALUE, `Capacity needs to be greater than 0. Given: ${capacity}.`);
		}

		this.cacheCapacity = capacity;
		this.usageRecency = new DoublyLinkedList<EvictableKeyNode<Key, Value>>();
	}

	/**
	 * @inheritDoc
	 */
	public onHit(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		this.usageRecency.toFront(entry);
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onMiss(_key: Key): void {
		return undefined; // eslint
	}

	/**
	 * @inheritDoc
	 */
	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>, context: SetOperationContext): void {
		// code bellow might throw, so on next call total entries might be higher, therefore using >=
		if (context.totalEntriesNo >= this.cacheCapacity) {
			this.deleteFromCache(this.usageRecency.tail!.key); // fixme addapt to onDelete hook
			this.usageRecency.remove(this.usageRecency.tail!);
		}

		entry.key = key;
		this.usageRecency.unshift(entry);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(_key: Key, _entry: CacheEntry<Value>, _context: SetOperationContext): void {
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
	public get requiresEntryOnDeletion(): boolean {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key>): void {
		this.deleteFromCache = deleter;
	}
}

export { LRUEvictionPolicy, EvictableKeyNode };
