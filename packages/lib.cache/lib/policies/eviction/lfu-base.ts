import { ErrorCodes, Nullable, Threshold } from '@thermopylae/core.declarations';
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
 * Base class for LFU policies.
 */
abstract class BaseLFUEvictionPolicy<Key, Value> implements CachePolicy<Key, Value> {
	protected readonly freqList: DoublyLinkedList<FreqListNode<Key, Value>>;

	private readonly config: LFUEvictionPolicyOptions;

	private delete: Deleter<Key>;

	/**
	 * @param capacity				{@link Cache} maximum capacity.
	 *
	 * @param bucketEvictCount		How many items to evict when {@link Cache} capacity is met. <br/>
	 *								Default value is 1.
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
			bucketEvictCount: bucketEvictCount || 1
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

	/**
	 * @inheritDoc
	 */
	public onGet(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		const newFrequency = this.computeEntryFrequency(entry, entry[FREQ_PARENT_ITEM_SYM].frequency);
		const frequencyBucket = this.findFrequencyBucket(entry[FREQ_PARENT_ITEM_SYM], newFrequency);

		this.removeEntryFromFrequencyBucket(entry[FREQ_PARENT_ITEM_SYM], entry);
		BaseLFUEvictionPolicy.addEntryToFrequencyBucket(frequencyBucket, entry);

		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>, context: SetOperationContext): void {
		// Check for backend overflow
		if (context.totalEntriesNo >= this.config.capacity) {
			this.evict(this.config.bucketEvictCount); // FIXME adapt to on delete hook
		}

		const newFrequency = this.computeEntryFrequency(entry, -1); // this is a hack, as concrete policies will increment it by 1
		const frequencyBucket = this.findFrequencyBucket(this.freqList.head, newFrequency);

		entry.key = key;
		BaseLFUEvictionPolicy.addEntryToFrequencyBucket(frequencyBucket, entry);
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
		this.removeEntryFromFrequencyBucket(entry[FREQ_PARENT_ITEM_SYM], entry);
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		this.freqList.clear();
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
		this.delete = deleter;
	}

	/**
	 * Delegate called before entry needs to be inserted in a frequency bucket. <br/>
	 * Entry will be inserted in the bucket that has frequency equal to result returned by this function.
	 *
	 * @param entry			Entry for which score needs to be computed.
	 * @param entryScore    Current score of the entry.
	 *
	 * @returns     New frequency of the entry.
	 */
	protected abstract computeEntryFrequency(entry: EvictableKeyNode<Key, Value>, entryScore: number): number;

	private findFrequencyBucket(startingFrom: Nullable<FreqListNode<Key, Value>>, needleFrequency: number): FreqListNode<Key, Value> {
		if (startingFrom != null) {
			if (needleFrequency === startingFrom.frequency) {
				return startingFrom; // when we continue to add repeatedly on the same bucket
			}

			let current: Nullable<FreqListNode<Key, Value>> = startingFrom;
			let addTo: keyof typeof DoublyLinkedList.prototype;
			let appendSym: typeof PREV_SYM | typeof NEXT_SYM;

			if (needleFrequency > startingFrom.frequency) {
				// we search forward until reaching the end or needed freq

				while (current && current.frequency <= needleFrequency) {
					if (current.frequency === needleFrequency) {
						return current;
					}
					current = current[NEXT_SYM];
				}

				addTo = 'addToBack'; // we reached end...
				appendSym = PREV_SYM; // ...or we go step back to add a new node
			} else {
				// we search backward until reaching the begin or needed freq

				while (current && current.frequency >= needleFrequency) {
					if (current.frequency === needleFrequency) {
						return current;
					}
					current = current[PREV_SYM];
				}

				addTo = 'addToFront'; // we reached begin...
				appendSym = NEXT_SYM; // ...or we go step forward to add a new node
			}

			const nodeWithNeedleFrequency: FreqListNode<Key, Value> = {
				frequency: needleFrequency,
				list: new DoublyLinkedList<EvictableKeyNode<Key, Value>>(),
				[PREV_SYM]: null,
				[NEXT_SYM]: null
			};

			if (current == null) {
				// we reached either begin or end
				this.freqList[addTo](nodeWithNeedleFrequency);
			} else {
				// we are somewhere in the middle
				this.freqList.appendAfter(current[appendSym]!, nodeWithNeedleFrequency);
			}

			return nodeWithNeedleFrequency;
		}

		// the frequency list is empty, code duplicated for performance, damn those 0.00000001 ms
		const nodeWithNeedleFrequency: FreqListNode<Key, Value> = {
			frequency: needleFrequency,
			list: new DoublyLinkedList<EvictableKeyNode<Key, Value>>(),
			[PREV_SYM]: null,
			[NEXT_SYM]: null
		};
		this.freqList.addToFront(nodeWithNeedleFrequency);

		return nodeWithNeedleFrequency;
	}

	private evict(count: number): void {
		const itemsList = this.freqList.head!.list; // evict is called when we have at least 1 entry

		while (count-- && itemsList.tail) {
			// remove from tail of list with same frequency
			this.delete(itemsList.tail.key);
			itemsList.removeNode(itemsList.tail);
		}

		if (!itemsList.tail) {
			this.freqList.removeNode(this.freqList.head!);
		}
	}

	private static addEntryToFrequencyBucket<K, V>(freqListNode: FreqListNode<K, V>, evictableKeyNode: EvictableKeyNode<K, V>): void {
		freqListNode.list.addToFront(evictableKeyNode); // the most fresh entry in this bucket
		evictableKeyNode[FREQ_PARENT_ITEM_SYM] = freqListNode; // set the new parent
	}

	private removeEntryFromFrequencyBucket(freqListNode: FreqListNode<Key, Value>, evictableKeyNode: EvictableKeyNode<Key, Value>): void {
		freqListNode.list.removeNode(evictableKeyNode);

		if (freqListNode.list.empty()) {
			this.freqList.removeNode(freqListNode);
		}
	}
}

export { BaseLFUEvictionPolicy, EvictableKeyNode };
