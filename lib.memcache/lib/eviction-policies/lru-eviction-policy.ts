import { Threshold } from '@thermopylae/core.declarations';
import { BaseCacheEntry } from '../caches/base-cache';
import { Deleter, EvictionPolicy } from '../contracts/eviction-policy';

interface DoublyLinkedListNode<Key = string, Value = any> extends BaseCacheEntry<Value> {
	key: Key;
	next: DoublyLinkedListNode<Key, Value> | null;
	prev: DoublyLinkedListNode<Key, Value> | null;
}

// FIXME original implementation: https://www.journaldev.com/32688/lru-cache-implementation-in-java

// FIXME OPTIMIZE THIS SHIIIIIIT!!!!!!

// FIXME TEST FOR MEMORY LEAKS

class LRUEvictionPolicy<Key = string, Value = any> implements EvictionPolicy<Key, Value, DoublyLinkedListNode<Key, Value>> {
	private readonly capacity: Threshold;

	private delete: Deleter<Key>;

	private lru: DoublyLinkedListNode<Key, Value> | null;

	private mru: DoublyLinkedListNode<Key, Value> | null;

	public constructor(deleter: Deleter<Key>, capacity: Threshold) {
		this.capacity = capacity;
		this.delete = deleter;
		// @ts-ignore
		this.lru = { next: null, prev: null, expires: null, value: null, key: null };
		this.mru = this.lru;
	}

	public onSet(key: Key, entry: DoublyLinkedListNode<Key, Value>, size: number): DoublyLinkedListNode<Key, Value> {
		// Put the new node at the right-most end of the linked-list
		entry.prev = this.mru;
		entry.next = null;
		entry.key = key;

		this.mru!.next = entry;
		this.mru = entry;

		// Delete the left-most entry and update the LRU pointer
		if (size === this.capacity) {
			this.delete(this.lru!.key);
			this.lru = this.lru!.next;
			this.lru!.prev = null;

			return entry;
		}

		// For the first added entry update the LRU pointer
		if (size === 0) {
			this.lru = entry;
		}

		return entry;
	}

	// eslint-disable-next-line consistent-return
	public onGet(key: Key, entry: DoublyLinkedListNode<Key, Value>): void {
		// If MRU leave the list as it is
		if (key === this.mru!.key) {
			return;
		}

		// Get the next and prev nodes
		const nextNode = entry.next;
		const prevNode = entry.prev;

		// If at the left-most, we update LRU
		if (key === this.lru!.key) {
			entry.prev = null;
			this.lru = nextNode;
		}
		// If we are in the middle, we need to update the items before and after our item
		else if (key !== this.mru!.key) {
			prevNode!.next = nextNode;
			nextNode!.prev = prevNode;
		}

		// Finally move our item to the MRU
		entry.prev = this.mru;
		this.mru!.next = entry;
		this.mru = entry;
		this.mru!.next = null;
	}

	public onDelete(key: Key): void {
		let temp = this.lru;
		while (temp !== null) {
			if (temp.key === key) {
				return this.deleteNode(temp);
			}
			temp = temp.next;
		}
	}

	public onClear(): void {
		// fixme there might be a memory leak
		this.lru = null;
		this.mru = null;
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	private deleteNode(node: DoublyLinkedListNode<Key, Value>): void {
		// if the node is head
		if (this.lru === node) {
			this.lru = node.next;
		}

		// change the next and prev only if they are not null
		if (node.next !== null) {
			node.next!.prev = node.prev;
		}

		if (node.prev !== null) {
			node.prev!.next = node.next;
		}

		// break circular dependencies
		node.next = null;
		node.prev = null;
	}
}

export { LRUEvictionPolicy };
