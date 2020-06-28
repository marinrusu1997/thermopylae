import { Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode } from '../../helpers/dll-list';
import { EvictionPolicy } from '../../contracts/sync/eviction-policy';
import { Deleter } from '../../contracts/sync/cache-policy';
import { CacheEntry } from '../../contracts/sync/cache-backend';

interface EvictableKeyNode<Key = string, Value = any> extends CacheEntry<Value>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {
	key: Key;
}

// FIXME original implementation: https://www.callicoder.com/design-lru-cache-data-structure/
// FIXME other implementation (not used here): https://www.programcreek.com/2013/03/leetcode-lru-cache-java/

class LRUEvictionPolicy<Key, Value> implements EvictionPolicy<Key, Value> {
	private readonly capacity: Threshold;

	private delete!: Deleter<Key>;

	private doublyLinkedList: DoublyLinkedList<EvictableKeyNode<Key, Value>>;

	public constructor(capacity: Threshold) {
		this.capacity = capacity;
		this.doublyLinkedList = new DoublyLinkedList<EvictableKeyNode<Key, Value>>();
	}

	public onGet(_key: Key, entry: EvictableKeyNode<Key, Value>): void {
		this.doublyLinkedList.moveToFront(entry);
	}

	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>, size: number): void {
		if (size === this.capacity) {
			this.delete(this.doublyLinkedList.tail!.key); // fixme addapt to onDelete hook
			this.doublyLinkedList.removeNode(this.doublyLinkedList.tail!);
		}

		entry.key = key;
		this.doublyLinkedList.addToFront(entry);
	}

	public onDelete(key: Key): void {
		let temp = this.doublyLinkedList.head;
		while (temp !== null) {
			if (temp.key === key) {
				return this.doublyLinkedList.removeNode(temp);
			}
			temp = temp.next;
		}
	}

	public onClear(): void {
		this.doublyLinkedList.clear();
	}

	public get requiresEntryOnDeletion(): boolean {
		return false;
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}
}

export { LRUEvictionPolicy };
