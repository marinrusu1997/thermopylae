import { Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode, NEXT_SYM, PREV_SYM } from '../../helpers/dll-list';
import { CachePolicy, Deleter, EntryValidity, SetOperationContext } from '../../contracts/sync/cache-policy';
import CacheEntry from '../../contracts/commons';
import CacheKey from '../../contracts/commons';

const FREQ_PARENT_ITEM_SYM = Symbol.for('FREQ_PARENT_ITEM_SYM');

interface FreqListNode<Key, Value> extends DoublyLinkedListNode<FreqListNode<Key, Value>> {
	frequency: number;
	list: DoublyLinkedList<EvictableKeyNode<Key, Value>>;
}

interface EvictableKeyNode<Key, Value> extends CacheEntry<Value>, CacheKey<Key>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {
	[FREQ_PARENT_ITEM_SYM]: FreqListNode<Key, Value>;
}

interface LFUEvictionPolicyOptions {
	capacity: Threshold;
	bucketEvictCount: number;
}

class LFUEvictionPolicy<Key, Value> implements CachePolicy<Key, Value> {
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

	public onGet(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		// get next freq item
		let nextFreqListNode = entry[FREQ_PARENT_ITEM_SYM][NEXT_SYM];

		const nextFrequency = entry[FREQ_PARENT_ITEM_SYM].frequency + 1;

		if (!nextFreqListNode || nextFreqListNode.frequency !== nextFrequency) {
			nextFreqListNode = {
				frequency: nextFrequency,
				list: new DoublyLinkedList<EvictableKeyNode<Key, Value>>(),
				[PREV_SYM]: null,
				[NEXT_SYM]: null
			};

			this.freqList.appendAfter(entry[FREQ_PARENT_ITEM_SYM], nextFreqListNode);
		}

		this.removeEvictableKeyNodeFromParentFreqNode(entry[FREQ_PARENT_ITEM_SYM], entry);
		nextFreqListNode.list.addToFront(entry);

		// Set the new parent
		entry[FREQ_PARENT_ITEM_SYM] = nextFreqListNode;

		return EntryValidity.VALID;
	}

	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>, context: SetOperationContext): void {
		// Check for backend overflow
		if (context.elements === this.config.capacity) {
			this.evict(this.config.bucketEvictCount); // FIXME adapt to on delete hook
		}

		entry.key = key;
		entry[FREQ_PARENT_ITEM_SYM] = this.addToFreqList(entry);
	}

	public onUpdate(): void {
		return undefined;
	}

	public onDelete(_key: Key, entry: EvictableKeyNode<Key, Value>): void {
		this.removeEvictableKeyNodeFromParentFreqNode(entry[FREQ_PARENT_ITEM_SYM], entry);
	}

	public onClear(): void {
		for (let it = this.freqList.iterator(), res = it.next(); !res.done; res = it.next()) {
			res.value.list.clear();
		}

		this.freqList.clear();
	}

	public get requiresEntryOnDeletion(): boolean {
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
				[NEXT_SYM]: null,
				[PREV_SYM]: null
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
