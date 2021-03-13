import { Nullable, UnixTimestamp } from '@thermopylae/core.declarations';
import { Heap } from '@thermopylae/lib.heap';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy, ExpirableCacheKeyedEntry, EXPIRES_AT_SYM } from './abstract';
import { EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';

/**
 * @internal
 */
interface CleanUpInterval {
	timeoutId: NodeJS.Timeout;
	willCleanUpOn: UnixTimestamp;
}

class ProactiveExpirationPolicy<Key, Value> extends AbstractExpirationPolicy<Key, Value> {
	private readonly entries: Heap<ExpirableCacheKeyedEntry<Key, Value>>;

	private cleanUpInterval: Nullable<CleanUpInterval>;

	public constructor() {
		super();

		this.entries = new Heap<ExpirableCacheKeyedEntry<Key, Value>>((first, second) => {
			return first[EXPIRES_AT_SYM]! - second[EXPIRES_AT_SYM]!;
		});
		this.cleanUpInterval = null;
	}

	public get size(): number {
		return this.entries.size();
	}

	public onHit(): EntryValidity {
		// here we should find and remove item from heap, but it would be to expensive to do on each get
		return EntryValidity.VALID;
	}

	public onSet(key: Key, entry: ExpirableCacheKeyedEntry<Key, Value>, context: SetOperationContext): void {
		if (ProactiveExpirationPolicy.isNonExpirable(context)) {
			return;
		}

		ProactiveExpirationPolicy.setEntryExpiration(entry, context.expiresAfter!, context.expiresFrom);
		entry.key = key;

		this.doScheduleDelete(entry);
	}

	public onUpdate(key: Key, entry: ExpirableCacheKeyedEntry<Key, Value>, context: SetOperationContext): void {
		const oldExpiration = entry[EXPIRES_AT_SYM];
		super.onUpdate(key, entry, context); // this will update entry ttl with some validations

		// @fixme this needs to be optimized, hugeee
		const keyIndex = this.entries.findIndex((item) => item.key === key);

		if (keyIndex !== -1) {
			if (entry[EXPIRES_AT_SYM] == null) {
				// item was added with ttl, but now it's ttl became INFINITE
				return this.doDelete(keyIndex);
			}

			if (oldExpiration === entry[EXPIRES_AT_SYM]) {
				// item was set with a great ttl, time passes, then it's ttl decreased, but summed up, we have same expiration
				return undefined;
			}

			this.entries.update(keyIndex, entry);
			return this.synchronize();
		}

		if (!ProactiveExpirationPolicy.isNonExpirable(context)) {
			// this is an update of item which had infinite timeout, now we need to track it
			entry.key = key;
			return this.doScheduleDelete(entry);
		}

		return undefined; // item had infinite ttl, and the new tll is also infinite
	}

	public onDelete(key: Key): void {
		// @ fixme this has no tests
		// @fixme can we optimize this? of course if we have entry we can directly know whether we track it or not

		// @fixme but what if we remember the index after entry is added into Heap?? we will build our own heap that will do this
		//  but take care to keep this index in sync, otherwise naspa
		const keyIndex = this.entries.findIndex((item) => item.key === key); // when key is root, find is O(1)

		if (keyIndex !== -1) {
			this.doDelete(keyIndex);
		}
	}

	public onClear(): void {
		// @ fixme this has no tests

		this.entries.clear();
		this.synchronize();
	}

	public get requiresEntryOnDeletion(): boolean {
		// @fixme this needs to dissappear
		return false;
	}

	public isIdle(): boolean {
		return this.cleanUpInterval == null;
	}

	private doDelete(entryIndex: number): void {
		// root might be removed, or heap structure might change, we need to sync with new root
		// on multiple keys with same `expiresAt` won't start timer
		// it will be started only when root value changes `for real`
		this.entries.remove(entryIndex);
		this.synchronize();
	}

	private doScheduleDelete(entry: ExpirableCacheKeyedEntry<Key, Value>): void {
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

	private scheduleNextGc<K, V>(rootEntry: ExpirableCacheKeyedEntry<K, V>): void {
		// in case runDelay <= 0, it's safe, as we will remove item immediately
		// (this might be caused because unixTime is actually a rounded value, so it can be rounded to current, or next second)
		const runDelay = rootEntry[EXPIRES_AT_SYM]! - chrono.unixTime(); // we track only items that have expires at
		this.cleanUpInterval!.willCleanUpOn = rootEntry[EXPIRES_AT_SYM]!;
		this.cleanUpInterval!.timeoutId = setTimeout(this.doCleanUp, runDelay * 1000);
	}
}

export { ProactiveExpirationPolicy };
