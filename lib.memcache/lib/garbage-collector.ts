import { Heap } from 'typescript-collections';
import { chrono } from '@marin/lib.utils';
import { createException, ErrorCodes, ErrorMessages } from './error';

class GarbageCollector<Key = string> {
	/**
	 * Deleter function used to remove expired items
	 */
	private readonly deleter: Deleter<Key>;

	/**
	 * Tracked items by GC which needs to be deleted
	 */
	private readonly trackedItems: Heap<TrackedItem<Key>>;

	/**
	 * Id of the internally used timer
	 */
	private timeoutId: NodeJS.Timeout | undefined;

	constructor(deleter: Deleter<Key>) {
		this.deleter = deleter;
		this.trackedItems = new Heap<TrackedItem<Key>>((first, second) => {
			if (first.whenToDelete < second.whenToDelete) {
				return -1;
			}
			if (first.whenToDelete > second.whenToDelete) {
				return 1;
			}
			return 0;
		});
	}

	private start(delay: number): void {
		this.timeoutId = setTimeout(() => {
			let item = this.trackedItems.peek(); // if we were invoked it is clear that first item needs to be deleted
			const whenToDeleteOfPrevItem = item!.whenToDelete;
			do {
				this.deleter(item!.key);
				this.trackedItems.removeRoot();
				item = this.trackedItems.peek();
				if (item && item.whenToDelete !== whenToDeleteOfPrevItem) {
					item = undefined;
				}
			} while (item); // remove all items with same when to delete timestamp
			const itemWhichNeedsToBeRemovedOnNextGC = this.trackedItems.peek();
			if (itemWhichNeedsToBeRemovedOnNextGC) {
				this.start(itemWhichNeedsToBeRemovedOnNextGC.whenToDelete - chrono.nowInSeconds()); // schedule next GC
			}
		}, delay * 1000);
	}

	/**
	 * Tracks the specified key for deletion
	 *
	 * @param key	Key which needs to be tracked
	 * @param ttl	Time to live in seconds
	 *
	 * @throws {Exception} When tracking failed
	 */
	public track(key: Key, ttl: number): void {
		const item: TrackedItem<Key> = {
			key,
			whenToDelete: chrono.nowInSeconds() + ttl
		};
		/* istanbul ignore if  */
		if (!this.trackedItems.add(item)) {
			throw createException(ErrorCodes.ITEM_TRACKING_FAILED, `${ErrorMessages.ITEM_TRACKING_FAILED} ${key}`);
		}
		if (this.trackedItems.size() === 1) {
			this.start(ttl); // restart GC
		}
	}

	/**
	 * Stops GC and clears all tracked items
	 */
	public stop(): void {
		/* istanbul ignore else  */
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.trackedItems.clear();
			this.timeoutId = undefined;
		}
	}
}

type Deleter<Key = string> = (key: Key) => void;
interface TrackedItem<Key = string> {
	whenToDelete: number;
	key: Key;
}

export { GarbageCollector };
