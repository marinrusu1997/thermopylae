import { ErrorCodes, Nullable, Percentage, Threshold } from '@thermopylae/core.declarations';
import { number } from '@thermopylae/lib.utils';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { DoublyLinkedList, DoublyLinkedListNode } from '../../helpers/doubly-linked-list';
import { LinkedList } from '../../contracts/linked-list';
import { createException } from '../../error';

const SEGMENT_SYM = Symbol('SEGMENT_SYM');

/**
 * @private		Should not appear in public documentation.
 */
const enum SegmentType {
	PROBATION,
	PROTECTED
}

/**
 * @private		Should not appear in public documentation.
 */
interface EvictableKeyNode<Key, Value> extends CacheEntry<Value>, CacheKey<Key>, DoublyLinkedListNode<EvictableKeyNode<Key, Value>> {
	[SEGMENT_SYM]: SegmentType;
}

/**
 * @private		Should not appear in public documentation.
 */
type Segments<Key, Value> = {
	[Segment in SegmentType]: {
		capacity: number;
		items: LinkedList<EvictableKeyNode<Key, Value>>;
	};
};

/**
 * [Segmented LRU](https://en.wikipedia.org/wiki/Cache_replacement_policies#Segmented_LRU_(SLRU) "Segmented LRU (SLRU)") eviction policy.
 */
class SegmentedLRUPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	private readonly segments: Segments<Key, Value>;

	private deleteFromCache!: Deleter<Key, Value>;

	/**
	 * @param cacheMaxCapacity              {@link Cache} maximum capacity.
	 * @param protectedOverProbationRatio   Size of protected segment expressed in % from `cacheMaxCapacity`.<br/>
	 * 										Defaults to 70%.
	 */
	public constructor(cacheMaxCapacity: Threshold, protectedOverProbationRatio: Percentage = 0.7) {
		if (cacheMaxCapacity < 2) {
			throw createException(ErrorCodes.INVALID_VALUE, `Capacity needs to be at least 2. Given: ${cacheMaxCapacity}.`);
		}

		const protectedSegmentSize = Math.round(
			number.percentage(cacheMaxCapacity, protectedOverProbationRatio) // percentage does implicit validation
		);
		if (protectedSegmentSize < 1) {
			const context = { cacheMaxCapacity, protectedOverProbationRatio, protectedSegmentSize };
			throw createException(ErrorCodes.INVALID_VALUE, `Protected segment size needs to be at least 1. Context: ${JSON.stringify(context)}.`);
		}

		this.segments = {
			[SegmentType.PROTECTED]: {
				capacity: protectedSegmentSize,
				items: new DoublyLinkedList<EvictableKeyNode<Key, Value>>()
			},
			[SegmentType.PROBATION]: {
				capacity: cacheMaxCapacity - protectedSegmentSize,
				items: new DoublyLinkedList<EvictableKeyNode<Key, Value>>()
			}
		};

		if (this.segments[SegmentType.PROBATION].capacity < 1) {
			const context = {
				cacheMaxCapacity,
				protectedOverProbationRatio,
				protectedSegmentSize,
				probationSegmentSize: this.segments[SegmentType.PROBATION].capacity
			};
			throw createException(ErrorCodes.INVALID_VALUE, `Probation segment size needs to be at least 1. Context: ${JSON.stringify(context)}.`);
		}
	}

	/**
	 * Get the number of the elements stored in internal structures of this policy.
	 */
	public get size(): number {
		let size = 0;
		for (const segment of (Object.keys(this.segments) as unknown) as Array<SegmentType>) {
			size += this.segments[segment].items.size;
		}
		return size;
	}

	/**
	 * Get most recently used key.
	 */
	public get mostRecent(): Nullable<EvictableKeyNode<Key, Value>> {
		return this.getEntryFrom('head');
	}

	/**
	 * Get least recently used key.
	 */
	public get leastRecent(): Nullable<EvictableKeyNode<Key, Value>> {
		return this.getEntryFrom('tail');
	}

	/**
	 * @inheritDoc
	 */
	public onGet(_key: Key, entry: EvictableKeyNode<Key, Value>): EntryValidity {
		this.promote(entry);
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onSet(key: Key, entry: EvictableKeyNode<Key, Value>): void {
		entry.key = key;
		this.demote(entry);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(_key: Key, entry: EvictableKeyNode<Key, Value>): void {
		this.segments[entry[SEGMENT_SYM]].items.remove(entry);
		entry[SEGMENT_SYM] = undefined!; // logical delete
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		for (const segment of (Object.keys(this.segments) as unknown) as Array<SegmentType>) {
			this.segments[segment].items.clear();
		}
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private isFull(segment: SegmentType): boolean {
		return this.segments[segment].items.size === this.segments[segment].capacity;
	}

	private demote(entry: EvictableKeyNode<Key, Value>): void {
		if (this.isFull(SegmentType.PROBATION)) {
			this.deleteFromCache(this.segments[SegmentType.PROBATION].items.tail!.key, this.segments[SegmentType.PROBATION].items.tail!);
			// entry will be removed from PROBATION segment list by `onDelete` hook
		}

		this.segments[SegmentType.PROBATION].items.unshift(entry);
		entry[SEGMENT_SYM] = SegmentType.PROBATION;
	}

	private promote(entry: EvictableKeyNode<Key, Value>): void {
		switch (entry[SEGMENT_SYM]) {
			case SegmentType.PROBATION:
				// we need to make room in the PROBATION first,
				// to exclude scenario when we move PROBATION TAIL and PROTECTED is full,
				// so item from PROTECTED needs to be inserted in PROBATION,
				// also, if we first add it to PROTECTED, it will overwrite NEXT & PREV links from PROBATION
				this.segments[SegmentType.PROBATION].items.remove(entry);

				if (this.isFull(SegmentType.PROTECTED)) {
					const tail = this.segments[SegmentType.PROTECTED].items.tail!;
					this.segments[SegmentType.PROTECTED].items.remove(tail);
					this.demote(tail);
				}

				this.segments[SegmentType.PROTECTED].items.unshift(entry);
				entry[SEGMENT_SYM] = SegmentType.PROTECTED;

				break;

			case SegmentType.PROTECTED:
				this.segments[SegmentType.PROTECTED].items.toFront(entry);
				break;

			default:
				throw createException(ErrorCodes.UNKNOWN, `Unknown segment type: ${entry[SEGMENT_SYM]} found in entry: ${JSON.stringify(entry)}.`);
		}
	}

	private getEntryFrom(pos: 'tail' | 'head'): Nullable<EvictableKeyNode<Key, Value>> {
		if (this.segments[SegmentType.PROTECTED].items[pos] == null) {
			if (this.segments[SegmentType.PROBATION].items[pos] == null) {
				return null;
			}
			return this.segments[SegmentType.PROBATION].items[pos];
		}
		return this.segments[SegmentType.PROTECTED].items[pos];
	}
}

export { SegmentedLRUPolicy, EvictableKeyNode, SegmentType, SEGMENT_SYM };
