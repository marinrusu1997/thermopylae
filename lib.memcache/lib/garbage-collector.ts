import { chrono } from '@thermopylae/lib.utils';
import { Heap } from '@thermopylae/lib.collections';
import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { INFINITE_TTL } from './cache';

const now = chrono.dateToUNIX;

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
	 * Schedules deletion of the key after x seconds
	 * starting from provided UNIX timestamp.
	 *
	 * @param key	Key which needs to be tracked
	 * @param after	Time to live in seconds
	 * @param from	Time from when tracking must be started
	 */
	public scheduleDeletion(key: Key, after: Seconds, from?: UnixTimestamp): void {
		if (after === INFINITE_TTL) {
			return; // there is no need to schedule immediate deletion
		}

		from = from || now();
		const item = { key, whenToDelete: from + after };

		this.doScheduleDelete(item);
	}

	/**
	 * This is a costly operation, as it requires
	 * rebuilding invariants of internal data structures.
	 */
	public reScheduleDeletion(key: Key, after: Seconds, from: UnixTimestamp = now()): void {
		if (after === INFINITE_TTL) {
			throw new Error('IMMEDIATE RESCHEDULING IS NOT SUPPORTED FOR NOW');
		}

		const update: TrackedItem<Key> = { key, whenToDelete: from + after };

		if (this.trackedItems.updateItem(update, item => item.key === key) !== undefined) {
			return this.synchronize();
		}

		// key was not tracked, scheduleDeletion it and take care of gc activity
		return this.doScheduleDelete(update);
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

	private start(runDelay: Seconds, willRunOn: UnixTimestamp): void {
		this.gcSprint!.willRunOn = willRunOn;
		this.gcSprint!.timeoutId = setTimeout(this.doClean, runDelay * 1000);
	}

	private doStart(willRunOn: UnixTimestamp): void {
		// @ts-ignore
		this.gcSprint = {};

		const runDelay = willRunOn - now();
		this.start(runDelay, willRunOn);
	}

	private doScheduleDelete(item: TrackedItem<Key>): void {
		this.trackedItems.push(item);

		if (this.isIdle()) {
			return this.doStart(item.whenToDelete);
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
		} while (itemToDelete !== undefined); // remove all items with same when to scheduleDeletion timestamp

		itemToDelete = this.trackedItems.peek();

		if (itemToDelete !== undefined) {
			this.start(itemToDelete.whenToDelete - now(), itemToDelete.whenToDelete); // schedule next GC
		} else {
			this.gcSprint = null; // mark gc has stopped implicitly
		}
	};

	private shutdown(): void {
		clearTimeout(this.gcSprint!.timeoutId);
		this.gcSprint = null;
	}

	private synchronize(): void {
		const root = this.trackedItems.peek()!;
		if (this.gcSprint!.willRunOn !== root.whenToDelete) {
			clearTimeout(this.gcSprint!.timeoutId);
			this.start(root.whenToDelete - now(), root.whenToDelete);
		}
	}
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

export { GarbageCollector, Deleter };
