import { Nullable } from '@thermopylae/core.declarations';
import { DoublyLinkedList, DoublyLinkedListNode, NEXT_SYM, PREV_SYM } from '../list/doubly-linked';
import { LinkedList } from '../list/interface';
import { BucketList } from './interface';

/**
 * @private
 */
const BUCKET_HEADER_SYM = Symbol('BUCKET_HEADER_SYM');

/**
 * @private
 */
interface BucketEntryNode<BucketEntry> extends DoublyLinkedListNode<BucketEntryNode<BucketEntry>> {
	[BUCKET_HEADER_SYM]: BucketHeaderNode<BucketEntry>;
}

/**
 * @private
 */
interface BucketHeaderNode<BucketEntry> extends DoublyLinkedListNode<BucketHeaderNode<BucketEntry>> {
	id: number;
	bucket: LinkedList<BucketEntry>;
}

/**
 * Data structure which keeps a list of ordered buckets by their id's.
 *
 * @private
 */
class OrderedBucketList<BucketEntry extends BucketEntryNode<BucketEntry>> implements BucketList<number, BucketEntry> {
	private readonly buckets: LinkedList<BucketHeaderNode<BucketEntry>>;

	public constructor() {
		this.buckets = new DoublyLinkedList<BucketHeaderNode<BucketEntry>>();
	}

	/**
	 * Get the first bucket header.
	 */
	public get head(): Nullable<BucketHeaderNode<BucketEntry>> {
		return this.buckets.head;
	}

	/**
	 * Get the last bucket header.
	 */
	public get tail(): Nullable<BucketHeaderNode<BucketEntry>> {
		return this.buckets.tail;
	}

	/**
	 * @inheritDoc
	 */
	public get numberOfBuckets(): number {
		return this.buckets.size;
	}

	/**
	 * Get total number of entries from ordered bucket list.
	 */
	public get size(): number {
		let items = 0;
		for (const bucketHeader of this.buckets) {
			items += (bucketHeader as BucketHeaderNode<BucketEntry>).bucket.size;
		}
		return items;
	}

	/**
	 * @inheritDoc
	 */
	public has(inTheBucketId: number, entry: BucketEntry): boolean {
		return entry[BUCKET_HEADER_SYM].id === inTheBucketId;
	}

	/**
	 * Add *entry* into *bucketId*. <br/>
	 * This operation has **O(N) complexity in worst case**, because it stats search of the *bucketId* from the list head.
	 * Therefore, is recommended to add entries to *bucketId* closer to the head, to reduce search time.
	 *
	 * @param bucketId		Id of the bucket where *entry* needs to be inserted.
	 * @param entry			Entry to be added.
	 */
	public add(bucketId: number, entry: BucketEntry): void {
		const bucketHeader = this.getInsertionBucket(this.buckets.head, bucketId);
		OrderedBucketList.addEntryToBucketHeader(bucketHeader, entry);
	}

	/**
	 * Move *entry* from it's current bucket into new bucket with *toBucketId* id. <br/>
	 * The same restrictions apply as in the {@link OrderedBucketList.add} method.
	 * Therefore, it's recommended that *toBucketId* being as closer as possible to entry's current bucked id.
	 *
	 * @param _fromBucketId	**Ignored parameter**.
	 * @param toBucketId	Id of the bucket where entry needs to be moved.
	 * @param entry			Entry to be moved.
	 */
	public move(_fromBucketId: number, toBucketId: number, entry: BucketEntry): void {
		const currentBucketId = entry[BUCKET_HEADER_SYM].id;
		if (toBucketId === currentBucketId) {
			// this will prevent scenario when `list` contains a single entry, so we remove it,
			// then try to find a freq parent node, but we get the same we removed earlier,
			// and frequency list remains corrupted while entry node is leaked
			return;
		}

		/* WARNING! Do not reorder these 3 lines ! */
		const bucketHeader = this.getInsertionBucket(entry[BUCKET_HEADER_SYM], toBucketId);
		this.removeEntryFromBucketHeader(entry);
		OrderedBucketList.addEntryToBucketHeader(bucketHeader, entry);
	}

	/**
	 * Removes entry from ordered bucket list. This operation has O(1) complexity.
	 *
	 * @param _fromBucketId		**Ignored parameter**.
	 * @param entry				Entry to be removed.
	 */
	public remove(_fromBucketId: number, entry: BucketEntry): void {
		this.removeEntryFromBucketHeader(entry);
	}

	/**
	 * Clear entries from ordered bucket list.
	 */
	public clear(): void {
		this.buckets.clear();
	}

	/**
	 * Get the id of the bucket where *entry* currently resides.
	 *
	 * @param entry		Queried entry.
	 */
	public static getBucketId<Entry extends BucketEntryNode<Entry>>(entry: Entry): number {
		return entry[BUCKET_HEADER_SYM].id;
	}

	private getInsertionBucket(startingBucketHeader: Nullable<BucketHeaderNode<BucketEntry>>, bucketId: number): BucketHeaderNode<BucketEntry> {
		if (startingBucketHeader != null) {
			if (startingBucketHeader.id === bucketId) {
				return startingBucketHeader; // when we continue to add repeatedly on the same bucket
			}

			let current: Nullable<BucketHeaderNode<BucketEntry>> = startingBucketHeader;
			let addTo: keyof typeof DoublyLinkedList.prototype;
			let appendSym: typeof PREV_SYM | typeof NEXT_SYM;

			if (bucketId > startingBucketHeader.id) {
				// we search forward until reaching the end or needed id

				while (current && current.id <= bucketId) {
					if (current.id === bucketId) {
						return current;
					}
					current = current[NEXT_SYM];
				}

				addTo = 'push'; // we reached end...
				appendSym = PREV_SYM; // ...or we go step back to add a new node
			} else {
				// we search backward until reaching the begin or needed id

				while (current && current.id >= bucketId) {
					if (current.id === bucketId) {
						return current;
					}
					current = current[PREV_SYM];
				}

				addTo = 'unshift'; // we reached begin...
				appendSym = NEXT_SYM; // ...or we go step forward to add a new node
			}

			const newBucketHeader: BucketHeaderNode<BucketEntry> = {
				id: bucketId,
				// @ts-ignore It actually satisfies the constraint
				bucket: new DoublyLinkedList<BucketEntry>(),
				[PREV_SYM]: null,
				[NEXT_SYM]: null
			};

			if (current == null) {
				// we reached either begin or end
				this.buckets[addTo](newBucketHeader);
			} else {
				// we are somewhere in the middle
				this.buckets.insertAfter(current[appendSym]!, newBucketHeader);
			}

			return newBucketHeader;
		}

		// the buckets list is empty, code duplicated for performance, damn those 0.00000001 ms
		const newBucketHeader: BucketHeaderNode<BucketEntry> = {
			id: bucketId,
			// @ts-ignore It actually satisfies constraints
			bucket: new DoublyLinkedList<BucketEntry>(),
			[PREV_SYM]: null,
			[NEXT_SYM]: null
		};
		this.buckets.unshift(newBucketHeader);

		return newBucketHeader;
	}

	private removeEntryFromBucketHeader(entry: BucketEntry): void {
		entry[BUCKET_HEADER_SYM].bucket.remove(entry);

		if (entry[BUCKET_HEADER_SYM].bucket.empty()) {
			this.buckets.remove(entry[BUCKET_HEADER_SYM]);
		}

		entry[BUCKET_HEADER_SYM] = undefined!; // soft delete
	}

	private static addEntryToBucketHeader<Entry extends BucketEntryNode<Entry>>(bucketHeader: BucketHeaderNode<Entry>, entry: Entry): void {
		bucketHeader.bucket.unshift(entry); // the most fresh entry in this bucket
		entry[BUCKET_HEADER_SYM] = bucketHeader; // set the new parent
	}
}

export { OrderedBucketList, BucketEntryNode, BUCKET_HEADER_SYM };
