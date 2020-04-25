import { Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode } from './dll-list';
import { Deleter, EvictionPolicy } from '../contracts/eviction-policy';
import { ExpirableCacheValue } from '../contracts/cache';

interface FreqListNode<Key = string, Value = any> extends DoublyLinkedListNode<FreqListNode<Key, Value>> {
	frequency: number;
	list: DoublyLinkedList<EvictableKeyNode<Key, Value>>;
}

interface EvictableKeyNode<Key = string, Value = any> extends ExpirableCacheValue<Value>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {
	key: Key;
	freqParentItem: FreqListNode<Key, Value>;
}

interface LFUEvictionPolicyOptions {
	capacity: Threshold;
	bucketEvictCount: number;
}

class LFUEvictionPolicy<Key = string, Value = any> implements EvictionPolicy<Key, Value, EvictableKeyNode<Key, Value>> {
	private readonly config: LFUEvictionPolicyOptions;

	private delete: Deleter<Key>;

	private readonly freqList: DoublyLinkedList<FreqListNode<Key, Value>>;

	constructor(capacity: number, bucketEvictCount?: number, deleter?: Deleter<Key>) {
		this.config = {
			capacity,
			bucketEvictCount: bucketEvictCount || Math.max(1, capacity * 0.1)
		};
		this.delete = deleter!;
		this.freqList = new DoublyLinkedList();
	}

	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>, size: number): EvictableKeyNode<Key, Value> {
		// Check for cache overflow
		if (size === this.config.capacity) {
			this.evict(this.config.bucketEvictCount);
		}

		entry.key = key;
		entry.freqParentItem = this.addToFreqList(entry);

		return entry;
	}

	public onGet(_key: Key, entry: EvictableKeyNode<Key, Value>): void {
		// get next freq item
		let nextFreqListNode = entry.freqParentItem.next;

		const nextFrequency = entry.freqParentItem.frequency + 1;

		if (!nextFreqListNode || nextFreqListNode.frequency !== nextFrequency) {
			nextFreqListNode = {
				frequency: nextFrequency,
				list: new DoublyLinkedList<EvictableKeyNode<Key, Value>>(),
				prev: null,
				next: null
			};

			this.freqList.appendAfter(entry.freqParentItem, nextFreqListNode);
		}

		this.removeEvictableKeyNodeFromParentFreqNode(entry.freqParentItem, entry);
		nextFreqListNode.list.addToFront(entry);

		// Set the new parent
		entry.freqParentItem = nextFreqListNode;
	}

	public onDelete(_key: Key, entry: EvictableKeyNode<Key, Value>): void {
		this.removeEvictableKeyNodeFromParentFreqNode(entry.freqParentItem, entry);
	}

	public onClear(): void {
		for (let it = this.freqList.iterator(), res = it.next(); !res.done; res = it.next()) {
			res.value.list.clear();
		}

		this.freqList.clear();
	}

	public get requiresEntryForDeletion(): boolean {
		return true;
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	private evict(count: number): void {
		const itemsList = this.freqList.head!.list;

		// eslint-disable-next-line no-plusplus
		while (count-- && itemsList.head) {
			this.delete(itemsList.head.key);
			itemsList.removeNode(itemsList.head);
		}

		if (!itemsList.head) {
			this.freqList.removeNode(this.freqList.head!);
		}
	}

	private addToFreqList(evictableKeyNode: EvictableKeyNode<Key, Value>): FreqListNode<Key, Value> {
		if (!this.freqList.head || this.freqList.head.frequency !== 0) {
			const freqListNode: FreqListNode<Key, Value> = {
				frequency: 0,
				list: new DoublyLinkedList<EvictableKeyNode<Key, Value>>(evictableKeyNode),
				next: null,
				prev: null
			};
			this.freqList.addToFront(freqListNode);
		} else {
			this.freqList.head.list.addToFront(evictableKeyNode);
		}

		return this.freqList.head!;
	}

	private removeEvictableKeyNodeFromParentFreqNode(freqListNode: FreqListNode<Key, Value>, evictableKeyNode: EvictableKeyNode<Key, Value>): void {
		freqListNode.list.removeNode(evictableKeyNode);

		if (freqListNode.list.empty()) {
			this.freqList.removeNode(freqListNode);
		}
	}
}

export { LFUEvictionPolicy };
