import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/cache-replacement-policy';
import { CacheEntry } from '../../contracts/commons';
import { DoublyLinkedList, DoublyLinkedListNode } from '../../data-structures/list/doubly-linked';
import { CircularBuffer } from '../../data-structures/circular-buffer';
import { createException, ErrorCodes } from '../../error';

// resource1: https://ryanhancock.medium.com/cache-me-if-you-can-updated-e8dd599df920
// resource2: https://www.youtube.com/watch?v=_XDHPhdQHMQ

/**
 * @internal
 */
const SEGMENT_TYPE_SYM = Symbol('ARC_SEGMENT_TYPE_SYM');

/**
 * @internal
 */
const enum SegmentType {
	/**
	 * Recent Cache Entries
	 */
	T1,
	/**
	 * Frequently-Used Entries
	 */
	T2
}

/**
 * @internal
 */
interface EvictableCacheEntry<Key, Value> extends CacheEntry<Key, Value>, DoublyLinkedListNode<EvictableCacheEntry<Key, Value>> {
	[SEGMENT_TYPE_SYM]: SegmentType;
}

/**
 * @internal
 */
interface CacheSegment<Key, Value> {
	capacity: number;
	block: DoublyLinkedList<EvictableCacheEntry<Key, Value>>;
	ghosts: CircularBuffer<Key>;
}

/**
 * [Adaptive Replacement Cache](https://en.wikipedia.org/wiki/Adaptive_replacement_cache "Adaptive Replacement Cache (ARC)") eviction policy.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class ArcEvictionPolicy<Key, Value, ArgumentsBundle = unknown> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	private readonly segments: Record<SegmentType, CacheSegment<Key, Value>>;

	private deleteFromCache!: Deleter<Key, Value>;

	/**
	 * @param cacheMaxCapacity	{@link Cache} maximum capacity.
	 */
	public constructor(cacheMaxCapacity: number) {
		if (cacheMaxCapacity < 2) {
			throw createException(ErrorCodes.INVALID_VALUE, `Cache maximum capacity needs to be at least 2.`);
		}

		this.segments = {
			[SegmentType.T1]: {
				capacity: Math.round(cacheMaxCapacity / 2),
				block: new DoublyLinkedList<EvictableCacheEntry<Key, Value>>(),
				ghosts: new CircularBuffer<Key>(Math.round(cacheMaxCapacity / 2))
			},
			[SegmentType.T2]: {
				capacity: 0,
				block: new DoublyLinkedList<EvictableCacheEntry<Key, Value>>(),
				ghosts: new CircularBuffer<Key>(Math.round(cacheMaxCapacity / 2))
			}
		};

		this.segments[SegmentType.T2].capacity = cacheMaxCapacity - this.segments[SegmentType.T1].capacity;
	}

	/**
	 * @inheritDoc
	 */
	public onHit(entry: EvictableCacheEntry<Key, Value>): EntryValidity {
		if (entry[SEGMENT_TYPE_SYM] === SegmentType.T1) {
			if (this.segments[SegmentType.T2].capacity === 0) {
				this.segments[SegmentType.T1].block.toTail(entry);
				return EntryValidity.VALID;
			}

			this.segments[SegmentType.T1].block.remove(entry);
			this.insertInT2(entry);
			return EntryValidity.VALID;
		}

		this.segments[SegmentType.T2].block.toFront(entry);
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onMiss(key: Key): void {
		if (this.segments[SegmentType.T1].ghosts.has(key)) {
			if (this.segments[SegmentType.T2].capacity === 0) {
				return;
			}

			this.segments[SegmentType.T1].capacity += 1;
			this.segments[SegmentType.T2].capacity -= 1;

			if (this.segments[SegmentType.T2].block.size > this.segments[SegmentType.T2].capacity) {
				this.deleteFromCache(this.segments[SegmentType.T2].block.tail!); // `onDelete` does the job
			}

			return;
		}

		if (this.segments[SegmentType.T2].ghosts.has(key)) {
			if (this.segments[SegmentType.T1].capacity === 0) {
				return;
			}

			this.segments[SegmentType.T2].capacity += 1;
			this.segments[SegmentType.T1].capacity -= 1;

			if (this.segments[SegmentType.T1].block.size > this.segments[SegmentType.T1].capacity) {
				this.deleteFromCache(this.segments[SegmentType.T1].block.head!); // `onDelete` does the job
			}
		}
	}

	/**
	 * @inheritDoc
	 */
	public onSet(entry: EvictableCacheEntry<Key, Value>): void {
		this.insertInT1(entry);
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
	public onDelete(entry: EvictableCacheEntry<Key, Value>): void {
		this.segments[entry[SEGMENT_TYPE_SYM]].block.remove(entry);
		this.segments[entry[SEGMENT_TYPE_SYM]].ghosts.add(entry.key);
		entry[SEGMENT_TYPE_SYM] = undefined!; // clear metadata
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		this.segments[SegmentType.T1].block.clear();
		this.segments[SegmentType.T1].ghosts.clear();
		this.segments[SegmentType.T2].block.clear();
		this.segments[SegmentType.T2].ghosts.clear();

		const cacheMaxCapacity = this.segments[SegmentType.T1].capacity + this.segments[SegmentType.T2].capacity;
		this.segments[SegmentType.T1].capacity = Math.round(cacheMaxCapacity / 2);
		this.segments[SegmentType.T2].capacity = cacheMaxCapacity - this.segments[SegmentType.T1].capacity;
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private insertInT1(entry: EvictableCacheEntry<Key, Value>): void {
		if (this.segments[SegmentType.T1].capacity === 0) {
			this.insertInT2(entry);
			return;
		}

		if (this.segments[SegmentType.T1].block.size === this.segments[SegmentType.T1].capacity) {
			this.deleteFromCache(this.segments[SegmentType.T1].block.head!); // `onDelete` will do the job
		}

		entry[SEGMENT_TYPE_SYM] = SegmentType.T1;
		this.segments[SegmentType.T1].block.push(entry);
	}

	private insertInT2(entry: EvictableCacheEntry<Key, Value>): void {
		if (this.segments[SegmentType.T2].block.size === this.segments[SegmentType.T2].capacity) {
			this.deleteFromCache(this.segments[SegmentType.T2].block.tail!); // `onDelete` does the job
		}

		entry[SEGMENT_TYPE_SYM] = SegmentType.T2;
		this.segments[SegmentType.T2].block.unshift(entry);
	}
}

export { ArcEvictionPolicy, EvictableCacheEntry, SegmentType, SEGMENT_TYPE_SYM };
