import { Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode, NEXT_SYM } from '../../helpers/dll-list';
import { CacheReplacementPolicy, EntryValidity, SetOperationContext, Deleter } from '../../contracts/cache-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';

/**
 * @private		Should not appear in public documentation.
 */
interface EvictableKeyNode<Key, Value> extends CacheEntry<Value>, CacheKey<Key>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {}

// FIXME original implementation: https://www.callicoder.com/design-lru-cache-data-structure/
// FIXME other implementation (not used here): https://www.programcreek.com/2013/03/leetcode-lru-cache-java/

/**
 * [Least Recently Used](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU) "Least recently used (LRU)") eviction policy.
 */
class LRUEvictionPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	private readonly capacity: Threshold;

	private delete!: Deleter<Key>;

	private doublyLinkedList: DoublyLinkedList<EvictableKeyNode<Key, Value>>;

	/**
	 * @param capacity	{@link Cache} maximum capacity.
	 */
	public constructor(capacity: Threshold) {
		this.capacity = capacity;
		this.doublyLinkedList = new DoublyLinkedList<EvictableKeyNode<Key, Value>>();
	}

	/**
	 * @inheritDoc
	 */
	public onHit(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		this.doublyLinkedList.moveToFront(entry);
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
		if (context.totalEntriesNo >= this.capacity) {
			this.delete(this.doublyLinkedList.tail!.key); // fixme addapt to onDelete hook
			this.doublyLinkedList.removeNode(this.doublyLinkedList.tail!);
		}

		entry.key = key;
		this.doublyLinkedList.addToFront(entry);
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
	public onDelete(key: Key, _entry?: CacheEntry<Value>): void {
		let temp = this.doublyLinkedList.head;
		while (temp !== null) {
			if (temp.key === key) {
				return this.doublyLinkedList.removeNode(temp);
			}
			temp = temp[NEXT_SYM];
		}
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		this.doublyLinkedList.clear();
	}

	/**
	 * @inheritDoc
	 */
	public get requiresEntryOnDeletion(): boolean {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}
}

export { LRUEvictionPolicy, EvictableKeyNode };
