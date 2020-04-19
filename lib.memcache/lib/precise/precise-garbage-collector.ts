import { chrono } from '@thermopylae/lib.utils';
import { Heap } from '@thermopylae/lib.collections';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

const INFINITE_TTL = 0;

const now = chrono.dateToUNIX;

class PreciseGarbageCollector<Key = string> {
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
	private gcSprint: GCSprint | null;

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
		this.gcSprint = null;
	}

	/**
	 * Tracks the specified key for deletion
	 *
	 * @param key		Key which needs to be tracked
	 * @param ttlSec	Time to live in seconds
	 */
	public track(key: Key, ttlSec: Seconds): void {
		if (ttlSec === INFINITE_TTL) {
			return; // infinite ttl means we don't need to track it
		}

		const item = {
			key,
			whenToDelete: now() + ttlSec
		};

		this.doTrack(item, ttlSec);
	}

	/**
	 * Updates the ttl of an existing key.
	 * This is a costly operation, as it requires
	 * rebuilding invariants of internal data structures.
	 *
	 * @param key
	 * @param ttlSec
	 */
	public reTrack(key: Key, ttlSec: Seconds): void {
		if (ttlSec === INFINITE_TTL) {
			throw new Error('UPDATING WITH INFINITE TTL IN NOT SUPPORTED YET');
		}

		const update: TrackedItem<Key> = {
			key,
			whenToDelete: now() + ttlSec
		};

		if (this.trackedItems.updateItem(update, item => item.key === key) !== undefined) {
			return this.synchronize();
		}

		// key was not tracked, track it and take care of gc activity
		return this.doTrack(update, ttlSec);
	}

	/**
	 * Check whether GC is running or not
	 */
	public isIdle(): boolean {
		return this.gcSprint === null;
	}

	/**
	 * Stops GC and clears all tracked items
	 */
	public stop(): void {
		if (!this.isIdle()) {
			this.shutdown();
			this.trackedItems.clear();
		}
	}

	private start(willRunOn: UnixTimestamp, remains: Seconds): void {
		this.gcSprint!.willRunOn = willRunOn;
		this.gcSprint!.timeoutId = setTimeout(this.doClean, remains * 1000);
	}

	private doStart(willRunOn: UnixTimestamp, remains: Seconds): void {
		// @ts-ignore
		this.gcSprint = {};
		this.start(willRunOn, remains);
	}

	private shutdown(): void {
		clearTimeout(this.gcSprint!.timeoutId);
		this.gcSprint = null;
	}

	private synchronize(): void {
		const root = this.trackedItems.peek()!;
		if (this.gcSprint!.willRunOn !== root.whenToDelete) {
			clearTimeout(this.gcSprint!.timeoutId);
			this.start(root.whenToDelete, root.whenToDelete - now());
		}
	}

	private doTrack(item: TrackedItem<Key>, deleteAfter: Seconds): void {
		this.trackedItems.push(item);

		if (this.isIdle()) {
			return this.doStart(item.whenToDelete, deleteAfter);
		}

		return this.synchronize();
	}

	private doClean = (): void => {
		let itemToDelete = this.trackedItems.peek(); // if we were invoked it is clear that first item needs to be deleted

		const whenToDeleteOfRootItem = itemToDelete!.whenToDelete;

		do {
			this.deleter(itemToDelete!.key);
			this.trackedItems.pop();
			itemToDelete = this.trackedItems.peek();
			if (itemToDelete && itemToDelete.whenToDelete !== whenToDeleteOfRootItem) {
				itemToDelete = undefined;
			}
		} while (itemToDelete !== undefined); // remove all items with same when to delete timestamp

		itemToDelete = this.trackedItems.peek();

		if (itemToDelete !== undefined) {
			this.start(itemToDelete.whenToDelete, itemToDelete.whenToDelete - now()); // schedule next GC
		} else {
			this.gcSprint = null; // mark gc has stopped implicitly
		}
	};
}

type Deleter<Key = string> = (key: Key) => void;

interface TrackedItem<Key = string> {
	whenToDelete: number;
	key: Key;
}

interface GCSprint {
	timeoutId: NodeJS.Timeout;
	willRunOn: UnixTimestamp;
}

export { PreciseGarbageCollector, Deleter, INFINITE_TTL };
