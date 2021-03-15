import { Nullable, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy, ExpirableCacheKeyedEntry, EXPIRES_AT_SYM } from './abstract';
import { EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';
import { Heap, HeapNode } from '../../helpers/heap';

/**
 * @internal
 */
interface CleanUpInterval {
	timeoutId: NodeJS.Timeout;
	willCleanUpOn: UnixTimestamp;
}

/**
 * @internal
 */
interface ExpirableCacheKeyedEntryHeapNode<Key, Value> extends ExpirableCacheKeyedEntry<Key, Value>, HeapNode {}

class ProactiveExpirationPolicy<Key, Value> extends AbstractExpirationPolicy<Key, Value> {
	private readonly entries: Heap<ExpirableCacheKeyedEntryHeapNode<Key, Value>>;

	private cleanUpInterval: Nullable<CleanUpInterval>;

	public constructor() {
		super();

		this.entries = new Heap<ExpirableCacheKeyedEntryHeapNode<Key, Value>>((first, second) => {
			return first[EXPIRES_AT_SYM]! - second[EXPIRES_AT_SYM]!;
		});
		this.cleanUpInterval = null;
	}

	public get size(): number {
		return this.entries.size;
	}

	public onHit(): EntryValidity {
		// here we should find and remove item from heap, but it would be to expensive to do on each get
		return EntryValidity.VALID;
	}

	// @fixme source of bugs, to be removed
	public onSet(key: Key, entry: ExpirableCacheKeyedEntryHeapNode<Key, Value>, context: SetOperationContext): void {
		if (ProactiveExpirationPolicy.isNonExpirable(context)) {
			return;
		}

		ProactiveExpirationPolicy.setEntryExpiration(entry, context.expiresAfter!, context.expiresFrom);
		entry.key = key;

		this.doScheduleDelete(entry);
	}

	public onUpdate(key: Key, entry: ExpirableCacheKeyedEntryHeapNode<Key, Value>, context: SetOperationContext): void {
		const oldExpiration = entry[EXPIRES_AT_SYM];
		super.onUpdate(key, entry, context); // this will update entry ttl with some validations

		if (Heap.isPartOfHeap(entry)) {
			if (entry[EXPIRES_AT_SYM] == null) {
				// item was added with ttl, but now it's ttl became INFINITE
				return this.doDelete(entry);
			}

			if (oldExpiration === entry[EXPIRES_AT_SYM]) {
				// item was set with a great ttl, time passes, then it's ttl decreased, but summed up, we have same expiration
				return undefined;
			}

			this.entries.heapifyUpdatedNode(entry); // notice that we updated `expiresAt` above
			return this.synchronize();
		}

		if (!ProactiveExpirationPolicy.isNonExpirable(context)) {
			// this is an update of item which had infinite timeout, now we need to track it
			entry.key = key;
			return this.doScheduleDelete(entry);
		}

		return undefined; // item had infinite ttl, and the new tll is also infinite
	}

	public onDelete(_key: Key, entry: ExpirableCacheKeyedEntryHeapNode<Key, Value>): void {
		if (Heap.isPartOfHeap(entry)) {
			this.doDelete(entry);
		}
	}

	public onClear(): void {
		this.entries.clear();
		this.synchronize();
	}

	public get requiresEntryOnDeletion(): boolean {
		// @fixme this needs to dissappear
		return true;
	}

	public isIdle(): boolean {
		return this.cleanUpInterval == null;
	}

	private doDelete(entry: ExpirableCacheKeyedEntryHeapNode<Key, Value>): void {
		// root might be removed, or heap structure might change, we need to sync with new root
		// on multiple keys with same `expiresAt` won't start timer
		// it will be started only when root value changes `for real`
		this.entries.delete(entry);
		this.synchronize();
	}

	private doScheduleDelete(entry: ExpirableCacheKeyedEntryHeapNode<Key, Value>): void {
		this.entries.push(entry);
		this.synchronize();
	}

	/**
	 * This method synchronizes garbage collection
	 * It needs to be called every time expirable keys heap is altered.
	 */
	private synchronize(): void {
		const rootEntry = this.entries.peek();

		if (rootEntry === undefined) {
			// cleanUpInterval might remain, if for example we got onClear/onDelete, and there were scheduled removal of items
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

	private doCleanUp = (): void => {
		let rootEntry = this.entries.peek();

		do {
			this.delete(rootEntry!.key); // remove from cache (if this throws we have meta-data and can retry operation)
			this.entries.pop(); // remove from internal structure

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

	private scheduleNextGc<K, V>(rootEntry: ExpirableCacheKeyedEntryHeapNode<K, V>): void {
		// in case runDelay <= 0, it's safe, as we will remove item immediately
		// (this might be caused because unixTime is actually a rounded value, so it can be rounded to current, or next second)
		const runDelay = rootEntry[EXPIRES_AT_SYM]! - chrono.unixTime(); // we track only items that have expires at
		this.cleanUpInterval!.willCleanUpOn = rootEntry[EXPIRES_AT_SYM]!;
		this.cleanUpInterval!.timeoutId = setTimeout(this.doCleanUp, runDelay * 1000);
	}
}

export { ProactiveExpirationPolicy, ExpirableCacheKeyedEntryHeapNode };
