import { Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode } from './dll-list';
import { ExpirableCacheValue } from '../contracts/cache';
import { Deleter, EvictionPolicy } from '../contracts/eviction-policy';

interface EvictableKeyNode<Key = string, Value = any> extends ExpirableCacheValue<Value>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {
	key: Key;
}

// FIXME original implementation: https://www.callicoder.com/design-lru-cache-data-structure/
// FIXME other implementation (not used here): https://www.programcreek.com/2013/03/leetcode-lru-cache-java/

class LRUEvictionPolicy<Key = string, Value = any> implements EvictionPolicy<Key, Value, EvictableKeyNode<Key, Value>> {
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

	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>, size: number): EvictableKeyNode<Key, Value> {
		if (size === this.capacity) {
			this.delete(this.doublyLinkedList.tail!.key);
			this.doublyLinkedList.removeNode(this.doublyLinkedList.tail!);
		}

		entry.key = key;
		this.doublyLinkedList.addToFront(entry);

		return entry;
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

	public requiresEntryForDeletion(): boolean {
		return false;
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}
}

export { LRUEvictionPolicy };
