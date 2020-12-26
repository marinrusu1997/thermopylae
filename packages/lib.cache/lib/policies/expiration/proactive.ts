import { Nullable, UnixTimestamp } from '@thermopylae/core.declarations';
import { Heap } from '@thermopylae/lib.heap';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy, ExpirableCacheEntry, EXPIRES_AT_SYM } from './abstract';
import { createException, ErrorCodes } from '../../error';
import { INFINITE_TTL } from '../../constants';
import { EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';
import { CacheKey } from '../../contracts/commons';

interface CleanUpInterval {
	timeoutId: NodeJS.Timeout;
	willCleanUpOn: UnixTimestamp;
}

interface ExpirableCacheKeyEntry<Key, Value> extends CacheKey<Key>, ExpirableCacheEntry<Value> {
	[EXPIRES_AT_SYM]: UnixTimestamp;
}

class ProactiveExpirationPolicy<Key, Value> extends AbstractExpirationPolicy<Key, Value> {
	private readonly entries: Heap<ExpirableCacheKeyEntry<Key, Value>>;

	private cleanUpInterval: Nullable<CleanUpInterval>;

	public constructor() {
		super();

		this.entries = new Heap<ExpirableCacheKeyEntry<Key, Value>>((first, second) => {
			if (first[EXPIRES_AT_SYM] < second[EXPIRES_AT_SYM]) {
				return -1;
			}
			if (first[EXPIRES_AT_SYM] > second[EXPIRES_AT_SYM]) {
				return 1;
			}
			return 0;
		});
		this.cleanUpInterval = null;
	}

	public get size(): number {
		return this.entries.size();
	}

	public get requiresEntryOnDeletion(): boolean {
		return false;
	}

	public onHit(): EntryValidity {
		// here we should find and remove item from heap, but it would be to expensive to do on each get
		return EntryValidity.VALID;
	}

	public onSet(key: Key, entry: ExpirableCacheKeyEntry<Key, Value>, context: SetOperationContext): void {
		if (context.expiresAfter == null || context.expiresAfter === INFINITE_TTL) {
			return;
		}

		super.setEntryExpiration(entry, context.expiresAfter, context.expiresFrom);
		entry.key = key;

		this.doScheduleDelete(entry);
	}

	public onUpdate(key: Key, entry: ExpirableCacheKeyEntry<Key, Value>, context: SetOperationContext): void {
		const oldExpiration = entry[EXPIRES_AT_SYM];

		super.onUpdate(key, entry, context);

		const keyIndex = this.findKeyIndex(key);

		// @fixme write some tests for these if's
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

		// this is an update of item which had infinite timeout, now we need to track it
		entry.key = key;
		return this.doScheduleDelete(entry);
	}

	public onDelete(key: Key): void {
		const keyIndex = this.findKeyIndex(key); // when key is root, find is O(1)

		if (keyIndex === -1) {
			throw createException(ErrorCodes.NOT_FOUND, `Attempt to delete key ${key} which isn't tracked. `);
		}

		this.doDelete(keyIndex);
	}

	public onClear(): void {
		this.entries.clear();
		this.synchronize();
	}

	public isIdle(): boolean {
		return this.cleanUpInterval == null;
	}

	private findKeyIndex(key: Key): number {
		const equals = (item: ExpirableCacheKeyEntry<Key, Value>): boolean => item.key === key;
		return this.entries.findIndex(equals);
	}

	private doDelete(entryIndex: number): void {
		// root might be removed, or heap structure might change, we need to sync with new root
		// on multiple keys with same `expiresAt` won't start timer
		// it will be started only when root value changes `for real`
		this.entries.remove(entryIndex);
		this.synchronize();
	}

	private doScheduleDelete(entry: ExpirableCacheKeyEntry<Key, Value>): void {
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

		if (rootEntry === undefined) {
			// @fixme to be removed
			throw createException(
				ErrorCodes.BAD_INVARIANT,
				`Clean up handler has been invoked, but expirable keys heap is empty. Scheduling had been made for ${this.cleanUpInterval!.willCleanUpOn}`
			);
		}

		do {
			this.delete(rootEntry.key); // remove from cache (if this throws we have meta-data and can retry operation)
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

	private scheduleNextGc<K, V>(rootEntry: ExpirableCacheKeyEntry<K, V>): void {
		const runDelay = rootEntry[EXPIRES_AT_SYM] - chrono.unixTime();
		this.cleanUpInterval!.willCleanUpOn = rootEntry[EXPIRES_AT_SYM];
		this.cleanUpInterval!.timeoutId = setTimeout(this.doCleanUp, runDelay * 1000);
	}
}

export { ProactiveExpirationPolicy, ExpirableCacheKeyEntry };
