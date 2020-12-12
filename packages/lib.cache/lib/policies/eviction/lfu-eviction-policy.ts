import { ErrorCodes, Threshold } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode, NEXT_SYM, PREV_SYM } from '../../helpers/dll-list';
import { CachePolicy, Deleter, EntryValidity, SetOperationContext } from '../../contracts/cache-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { createException } from '../../error';

/**
 * @private		Should not appear in public documentation.
 */
const FREQ_PARENT_ITEM_SYM = Symbol.for('FREQ_PARENT_ITEM_SYM');

/**
 * @private		Should not appear in public documentation.
 */
interface EvictableKeyNode<Key, Value> extends CacheEntry<Value>, CacheKey<Key>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {
	[FREQ_PARENT_ITEM_SYM]: FreqListNode<Key, Value>;
}

/**
 * @private		Should not appear in public documentation.
 */
interface FreqListNode<Key, Value> extends DoublyLinkedListNode<FreqListNode<Key, Value>> {
	frequency: number;
	list: DoublyLinkedList<EvictableKeyNode<Key, Value>>;
}

/**
 * @private		Should not appear in public documentation.
 */
interface LFUEvictionPolicyOptions {
	capacity: Threshold;
	bucketEvictCount: number;
}

/**
 * [Least Frequently Used](https://en.wikipedia.org/wiki/Least_frequently_used "Least frequently used") eviction policy.
 */
class LFUEvictionPolicy<Key, Value> implements CachePolicy<Key, Value> {
	private readonly config: LFUEvictionPolicyOptions;

	private delete: Deleter<Key>;

	private readonly freqList: DoublyLinkedList<FreqListNode<Key, Value>>;

	/**
	 * @param capacity				{@link Cache} maximum capacity.
	 *
	 * @param bucketEvictCount		How many items to evict when {@link Cache} capacity is met. <br/>
	 *								Default value is between 1 element and 10% of the `capacity` elements.
	 *
	 * @param deleter				Function which is deletes entry from {@link Cache} by key. <br/>
	 * 								Default will be deleter set by {@link Cache} instance.
	 */
	public constructor(capacity: number, bucketEvictCount?: number, deleter?: Deleter<Key>) {
		if (capacity <= 0) {
			throw createException(ErrorCodes.INVALID_VALUE, `Capacity needs to be greater than 0. Given: ${capacity}.`);
		}

		this.config = {
			capacity,
			bucketEvictCount: bucketEvictCount || Math.max(1, capacity * 0.1)
		};
		this.delete = deleter!;
		this.freqList = new DoublyLinkedList();
	}

	/**
	 * @returns		Total number of elements from frequency list.
	 */
	public get size(): number {
		let items = 0;
		for (const freqListNode of this.freqList) {
			items += (freqListNode as FreqListNode<Key, Value>).list.size;
		}
		return items;
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
		if (context.totalEntriesNo === this.config.capacity) {
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
		for (const freqListNode of this.freqList) {
			(freqListNode as FreqListNode<Key, Value>).list.clear();
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

export { LFUEvictionPolicy, EvictableKeyNode };
