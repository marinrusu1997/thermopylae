import { Nullable, Undefinable, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { EntryExpiredCallback, ExpirableEntry, GarbageCollector } from './interface';
import { Heap, HeapNode } from '../heap';
import { EXPIRES_AT_SYM } from '../../constants';

// @fixme use eviction timer
/**
 * @internal
 */
interface CleanUpInterval {
	timeoutId: NodeJS.Timeout;
	willCleanUpOn: UnixTimestamp;
}

interface HeapExpirableEntry extends ExpirableEntry, HeapNode {}

class HeapGarbageCollector<T extends HeapExpirableEntry> implements GarbageCollector<T> {
	private readonly entries: Heap<T>;

	private cleanUpInterval: Nullable<CleanUpInterval>;

	private entryExpiredCb: EntryExpiredCallback<T>;

	public constructor(entryExpiredCb?: EntryExpiredCallback<T>) {
		this.entries = new Heap<T>((first, second) => {
			return first[EXPIRES_AT_SYM]! - second[EXPIRES_AT_SYM]!;
		});
		this.cleanUpInterval = null;
		this.entryExpiredCb = entryExpiredCb || HeapGarbageCollector.defaultEntryExpiredCallback;
	}

	public get size(): number {
		return this.entries.size;
	}

	public get idle(): boolean {
		return this.cleanUpInterval == null;
	}

	public manage(entry: T): void {
		this.entries.push(entry);
		this.synchronizeEvictionTimer();
	}

	public isManaged(entry: T): boolean {
		return Heap.isPartOfHeap(entry);
	}

	public update(_oldExpiration: UnixTimestamp, entry: T): void {
		if (!this.isManaged(entry)) {
			return;
		}

		this.entries.heapifyUpdatedNode(entry);
		this.synchronizeEvictionTimer();
	}

	public leave(entry: T): void {
		if (!this.isManaged(entry)) {
			return;
		}

		// root might be removed, or heap structure might change, we need to sync with new root
		// on multiple keys with same `expiresAt` won't start timer
		// it will be started only when root value changes `for real`
		this.entries.delete(entry);
		this.synchronizeEvictionTimer();
	}

	public clear(): void {
		this.entries.clear();
		this.synchronizeEvictionTimer();
	}

	public setEntryExpiredCallback(cb: EntryExpiredCallback<T>): void {
		this.entryExpiredCb = cb;
	}

	/**
	 * This method synchronizes garbage collection. <br/>
	 * It needs to be called every time expirable keys heap is altered.
	 */
	private synchronizeEvictionTimer(): void {
		const rootEntry = this.entries.peek();

		if (rootEntry === undefined) {
			// cleanUpInterval might remain, if for example we got clear/leave, and there were scheduled removal of items
			if (this.cleanUpInterval != null) {
				clearTimeout(this.cleanUpInterval.timeoutId);
				this.cleanUpInterval = null;
			}
			return;
		}

		if (this.cleanUpInterval == null) {
			this.cleanUpInterval = {
				willCleanUpOn: 0,
				timeoutId: (null as unknown) as NodeJS.Timeout
			};
			this.scheduleNextGc(rootEntry);

			return;
		}

		if (this.cleanUpInterval.willCleanUpOn !== rootEntry[EXPIRES_AT_SYM]) {
			clearTimeout(this.cleanUpInterval.timeoutId);
			this.scheduleNextGc(rootEntry);
		}
	}

	private scheduleNextGc(rootEntry: T): void {
		// in case runDelay <= 0, it's safe, as we will remove item immediately
		// (this might be caused because unixTime is actually a rounded value, so it can be rounded to current, or next second)
		const runDelay = rootEntry[EXPIRES_AT_SYM]! - chrono.unixTime(); // we track only items that have expires at
		this.cleanUpInterval!.willCleanUpOn = rootEntry[EXPIRES_AT_SYM]!;
		this.cleanUpInterval!.timeoutId = setTimeout(this.evictExpiredEntries, runDelay * 1000);
	}

	private evictExpiredEntries = (): void => {
		let rootEntry: Undefinable<T>;

		do {
			// remove from internal structure (we do this here, so that in case entryExpiredCb tries to `leave` entry,
			// we won't try to delete it again and restart a parallel timer)
			rootEntry = this.entries.pop();
			this.entryExpiredCb(rootEntry!);

			rootEntry = this.entries.peek();

			if (rootEntry === undefined) {
				this.cleanUpInterval = null;
				return; // done
			}

			if (rootEntry[EXPIRES_AT_SYM] !== this.cleanUpInterval!.willCleanUpOn) {
				this.scheduleNextGc(rootEntry);
				return;
			}

			// eslint-disable-next-line no-constant-condition
		} while (true);
	};

	private static defaultEntryExpiredCallback(): void {
		return undefined;
	}
}

export { HeapGarbageCollector, HeapExpirableEntry };
