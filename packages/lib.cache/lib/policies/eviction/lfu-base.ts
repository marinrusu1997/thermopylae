import { ErrorCodes, Nullable } from '@thermopylae/core.declarations';
import { array } from '@thermopylae/lib.utils';
import { DoublyLinkedList, DoublyLinkedListNode, NEXT_SYM, PREV_SYM } from '../../helpers/doubly-linked-list';
import { CacheReplacementPolicy, Deleter, EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { createException } from '../../error';
import { LinkedList } from '../../contracts/linked-list';

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
	cacheEntries: LinkedList<EvictableKeyNode<Key, Value>>;
}

/**
 * Formats a string into displayable output.
 *
 * @param str	Input string.
 *
 * @returns		Formatted string.
 */
type StringFormatter = (str: string) => string;

/**
 * Base class for LFU policies.
 */
abstract class BaseLFUEvictionPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	private static readonly FORMAT_COLORS: Array<StringFormatter> = [(str) => str];

	private readonly frequencies: LinkedList<FreqListNode<Key, Value>>;

	private readonly cacheCapacity: number;

	private deleteFromCache!: Deleter<Key>;

	/**
	 * @param capacity				{@link Cache} maximum capacity.
	 */
	public constructor(capacity: number) {
		if (capacity <= 0) {
			throw createException(ErrorCodes.INVALID_VALUE, `Capacity needs to be greater than 0. Given: ${capacity}.`);
		}

		this.cacheCapacity = capacity;
		this.frequencies = new DoublyLinkedList<FreqListNode<Key, Value>>();
	}

	/**
	 * @returns		Total number of elements from frequency list.
	 */
	public get size(): number {
		let items = 0;
		for (const freqListNode of this.frequencies) {
			items += (freqListNode as FreqListNode<Key, Value>).cacheEntries.size;
		}
		return items;
	}

	/**
	 * @inheritDoc
	 */
	public onHit(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		const newFrequency = this.computeEntryFrequency(entry, BaseLFUEvictionPolicy.frequency(entry));

		if (newFrequency === BaseLFUEvictionPolicy.frequency(entry)) {
			// this will prevent scenario when `list` contains a single entry, so we remove it,
			// then try to find a freq parent node, but we get the same we removed earlier,
			// and frequency list remains corrupted while entry node is leaked
			return EntryValidity.VALID;
		}

		/* WARNING! Do not reorder these 3 lines ! */
		const frequencyBucket = this.findFrequencyBucket(entry[FREQ_PARENT_ITEM_SYM], newFrequency);
		this.removeEntryFromFrequencyBucket(entry[FREQ_PARENT_ITEM_SYM], entry);
		BaseLFUEvictionPolicy.addEntryToFrequencyBucket(frequencyBucket, entry);

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
		// Check for backend overflow
		if (context.totalEntriesNo >= this.cacheCapacity) {
			this.evict(); // @fixme adapt to on delete hook
		}

		const frequencyBucket = this.findFrequencyBucket(this.frequencies.head, this.initialFrequency);

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
		this.frequencies.clear();
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key>): void {
		this.deleteFromCache = deleter;
	}

	/**
	 * Get frequency of the entry.
	 *
	 * @param entry		Cache entry.
	 */
	public static frequency<K, V>(entry: EvictableKeyNode<K, V>): number {
		return entry[FREQ_PARENT_ITEM_SYM].frequency;
	}

	/**
	 * Returns string representation of the frequency list.
	 *
	 * @param colors	Colors used for bucket formatting.
	 */
	public toFormattedString(colors: Array<StringFormatter>): string {
		const str = new Array<string>();

		for (const freqListNode of this.frequencies) {
			const freqListNodeTyped = freqListNode as FreqListNode<Key, Value>;
			const keys = new Array<Key>();

			for (const node of freqListNodeTyped.cacheEntries) {
				keys.push((node as EvictableKeyNode<Key, Value>).key);
			}

			str.push(array.randomElement(colors)(`${String(freqListNodeTyped.frequency)} -> [ ${keys.join()} ]`));
		}

		return `[ ${str.join(', ')} ]`;
	}

	/**
	 * Returns stringify-ed JSON representation.
	 */
	public toJSON(): string {
		return this.toFormattedString(BaseLFUEvictionPolicy.FORMAT_COLORS);
	}

	/**
	 * @returns 	Entry initial starting frequency.
	 */
	protected abstract get initialFrequency(): number;

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

	/**
	 * Delegate called after item has been evicted from cache.
	 *
	 * @param from		Frequency list node from where item has been removed.
	 */
	protected abstract onEvict(from: FreqListNode<Key, Value>): void;

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

				addTo = 'push'; // we reached end...
				appendSym = PREV_SYM; // ...or we go step back to add a new node
			} else {
				// we search backward until reaching the begin or needed freq

				while (current && current.frequency >= needleFrequency) {
					if (current.frequency === needleFrequency) {
						return current;
					}
					current = current[PREV_SYM];
				}

				addTo = 'unshift'; // we reached begin...
				appendSym = NEXT_SYM; // ...or we go step forward to add a new node
			}

			const nodeWithNeedleFrequency: FreqListNode<Key, Value> = {
				frequency: needleFrequency,
				cacheEntries: new DoublyLinkedList<EvictableKeyNode<Key, Value>>(),
				[PREV_SYM]: null,
				[NEXT_SYM]: null
			};

			if (current == null) {
				// we reached either begin or end
				this.frequencies[addTo](nodeWithNeedleFrequency);
			} else {
				// we are somewhere in the middle
				this.frequencies.splice(current[appendSym]!, nodeWithNeedleFrequency);
			}

			return nodeWithNeedleFrequency;
		}

		// the frequency list is empty, code duplicated for performance, damn those 0.00000001 ms
		const nodeWithNeedleFrequency: FreqListNode<Key, Value> = {
			frequency: needleFrequency,
			cacheEntries: new DoublyLinkedList<EvictableKeyNode<Key, Value>>(),
			[PREV_SYM]: null,
			[NEXT_SYM]: null
		};
		this.frequencies.unshift(nodeWithNeedleFrequency);

		return nodeWithNeedleFrequency;
	}

	private evict(): void {
		const currentFreqListHead = this.frequencies.head!;

		this.deleteFromCache(currentFreqListHead.cacheEntries.tail!.key);
		this.removeEntryFromFrequencyBucket(currentFreqListHead, currentFreqListHead.cacheEntries.tail!);

		// previous function might update `this.freqList` head, that's we pass a copy of the head to this function
		// as it needs the node from where item was evicted
		this.onEvict(currentFreqListHead);
	}

	private static addEntryToFrequencyBucket<K, V>(freqListNode: FreqListNode<K, V>, evictableKeyNode: EvictableKeyNode<K, V>): void {
		freqListNode.cacheEntries.unshift(evictableKeyNode); // the most fresh entry in this bucket
		evictableKeyNode[FREQ_PARENT_ITEM_SYM] = freqListNode; // set the new parent
	}

	private removeEntryFromFrequencyBucket(freqListNode: FreqListNode<Key, Value>, evictableKeyNode: EvictableKeyNode<Key, Value>): void {
		freqListNode.cacheEntries.remove(evictableKeyNode);

		if (freqListNode.cacheEntries.empty()) {
			this.frequencies.remove(freqListNode);
		}

		evictableKeyNode[FREQ_PARENT_ITEM_SYM] = (null as unknown) as FreqListNode<Key, Value>;
	}
}

export { BaseLFUEvictionPolicy, EvictableKeyNode, FreqListNode, StringFormatter };
