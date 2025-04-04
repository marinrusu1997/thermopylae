import { types } from '@thermopylae/lib.utils';
import { CircularBuffer } from '../../data-structures/circular-buffer.js';
import { DoublyLinkedList, type DoublyLinkedListNode } from '../../data-structures/list/doubly-linked.js';
import { ErrorCodes, createException } from '../../error.js';
import { type CacheReplacementPolicy, type Deleter, EntryValidity } from '../../typings/cache-replacement-policy.js';
import type { CacheEntry } from '../../typings/commons.js';

// resource1: https://ryanhancock.medium.com/cache-me-if-you-can-updated-e8dd599df920
// resource2: https://www.youtube.com/watch?v=_XDHPhdQHMQ

/** @private */
const SEGMENT_TYPE_SYM = Symbol('ARC_SEGMENT_TYPE_SYM');

/** @private */
enum SegmentType {
	/** Recent Cache Entries. */
	T1 = 0,
	/** Frequently-Used Entries. */
	T2 = 1
}

/** @private */
interface EvictableCacheEntry<Key, Value> extends CacheEntry<Key, Value>, DoublyLinkedListNode<EvictableCacheEntry<Key, Value>> {
	[SEGMENT_TYPE_SYM]: SegmentType;
}

/** @private */
interface CacheSegment<Key, Value> {
	capacity: number;
	block: DoublyLinkedList<EvictableCacheEntry<Key, Value>>;
	ghosts: CircularBuffer<Key>;
}

/**
 * [Adaptive Replacement Cache](https://en.wikipedia.org/wiki/Adaptive_replacement_cache) eviction
 * policy.
 *
 * @template Key Type of the key.
 * @template Value Type of the value.
 * @template ArgumentsBundle Type of the arguments bundle.
 */
class ArcEvictionPolicy<Key, Value, ArgumentsBundle = unknown> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	private readonly segments: Record<SegmentType, CacheSegment<Key, Value>>;

	private deleteFromCache!: Deleter<Key, Value>;

	/** @param cacheMaxCapacity {@link Cache} maximum capacity. */
	public constructor(cacheMaxCapacity: number) {
		if (cacheMaxCapacity < 2) {
			throw createException(ErrorCodes.INVALID_CACHE_MAX_CAPACITY, `Cache maximum capacity needs to be at least 2.`);
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

	/** @inheritdoc */
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

	/** @inheritdoc */
	public onMiss(key: Key): void {
		if (this.segments[SegmentType.T1].ghosts.has(key)) {
			if (this.segments[SegmentType.T2].capacity === 0) {
				return;
			}

			this.segments[SegmentType.T1].capacity += 1;
			this.segments[SegmentType.T2].capacity -= 1;

			if (this.segments[SegmentType.T2].block.size > this.segments[SegmentType.T2].capacity && this.segments[SegmentType.T2].block.tail) {
				this.deleteFromCache(this.segments[SegmentType.T2].block.tail); // `onDelete` does the job
			}

			return;
		}

		if (this.segments[SegmentType.T2].ghosts.has(key)) {
			if (this.segments[SegmentType.T1].capacity === 0) {
				return;
			}

			this.segments[SegmentType.T2].capacity += 1;
			this.segments[SegmentType.T1].capacity -= 1;

			if (this.segments[SegmentType.T1].block.size > this.segments[SegmentType.T1].capacity && this.segments[SegmentType.T1].block.head) {
				this.deleteFromCache(this.segments[SegmentType.T1].block.head); // `onDelete` does the job
			}
		}
	}

	/** @inheritdoc */
	public onSet(entry: EvictableCacheEntry<Key, Value>): void {
		this.insertInT1(entry);
	}

	/** @inheritdoc */
	public onUpdate(): void {
		return undefined;
	}

	/** @inheritdoc */
	public onDelete(entry: EvictableCacheEntry<Key, Value>): void {
		this.segments[entry[SEGMENT_TYPE_SYM]].block.remove(entry);
		this.segments[entry[SEGMENT_TYPE_SYM]].ghosts.add(entry.key);
		entry[SEGMENT_TYPE_SYM] = types.SOFT_DELETE; // clear metadata
	}

	/** @inheritdoc */
	public onClear(): void {
		this.segments[SegmentType.T1].block.clear();
		this.segments[SegmentType.T1].ghosts.clear();
		this.segments[SegmentType.T2].block.clear();
		this.segments[SegmentType.T2].ghosts.clear();

		const cacheMaxCapacity = this.segments[SegmentType.T1].capacity + this.segments[SegmentType.T2].capacity;
		this.segments[SegmentType.T1].capacity = Math.round(cacheMaxCapacity / 2);
		this.segments[SegmentType.T2].capacity = cacheMaxCapacity - this.segments[SegmentType.T1].capacity;
	}

	/** @inheritdoc */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private insertInT1(entry: EvictableCacheEntry<Key, Value>): void {
		if (this.segments[SegmentType.T1].capacity === 0) {
			this.insertInT2(entry);
			return;
		}

		if (this.segments[SegmentType.T1].block.size === this.segments[SegmentType.T1].capacity && this.segments[SegmentType.T1].block.head) {
			this.deleteFromCache(this.segments[SegmentType.T1].block.head); // `onDelete` will do the job
		}

		entry[SEGMENT_TYPE_SYM] = SegmentType.T1;
		this.segments[SegmentType.T1].block.push(entry);
	}

	private insertInT2(entry: EvictableCacheEntry<Key, Value>): void {
		if (this.segments[SegmentType.T2].block.size === this.segments[SegmentType.T2].capacity && this.segments[SegmentType.T2].block.tail) {
			this.deleteFromCache(this.segments[SegmentType.T2].block.tail); // `onDelete` does the job
		}

		entry[SEGMENT_TYPE_SYM] = SegmentType.T2;
		this.segments[SegmentType.T2].block.unshift(entry);
	}
}

export { ArcEvictionPolicy, type EvictableCacheEntry, SegmentType, SEGMENT_TYPE_SYM };
