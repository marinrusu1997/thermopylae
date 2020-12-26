import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
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

class ProactiveExpirationPolicy<Key = string, Value = any> extends AbstractExpirationPolicy<Key, Value> {
	private readonly expirableKeys: Heap<ExpirableCacheKeyEntry<Key, Value>>;

	private cleanUpInterval: CleanUpInterval | null;

	constructor() {
		super();

		this.expirableKeys = new Heap<ExpirableCacheKeyEntry<Key, Value>>((first, second) => {
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

	public onHit(): EntryValidity {
		// here we should find and remove item from heap, but it would be to expensive to do on each get
		return EntryValidity.VALID;
	}

	public onSet(key: Key, entry: ExpirableCacheKeyEntry<Key, Value>, context: SetOperationContext): void {
		if (context.expiresAfter == null || context.expiresAfter === INFINITE_TTL) {
			return;
		}

		super.setEntryExpiration(entry, context.expiresAfter, context.expiresFrom);
		this.decorateEntry(entry, key);

		this.doScheduleDelete((entry as unknown) as ExpirableCacheKeyEntry<Key, Value>);
	}

	public onUpdate(key: Key, entry: ExpirableCacheKeyEntry<Key, Value>, context: SetOperationContext): void {
		const oldExpiration = entry[EXPIRES_AT_SYM];

		super.onUpdate(key, entry, context);

		const keyIndex = this.findKeyIndex(key);

		if (keyIndex !== -1) {
			if (entry[EXPIRES_AT_SYM] == null) {
				// item was added with ttl, but now it's ttl became INFINITE
				return this.doDelete(keyIndex);
			}

			if (oldExpiration === entry[EXPIRES_AT_SYM]) {
				// item was set with a great ttl, time passes, then it's ttl decreased, but summed up, we have same expiration
				return;
			}

			this.expirableKeys.update(keyIndex, (entry as unknown) as ExpirableCacheKeyEntry<Key, Value>);
			return this.synchronize();
		}

		// this is an update of item which had infinite timeout, now we need to track it
		this.decorateEntry(entry, key);
		return this.doScheduleDelete((entry as unknown) as ExpirableCacheKeyEntry<Key, Value>);
	}

	public onDelete(key: Key): void {
		const keyIndex = this.findKeyIndex(key); // when key is root, find is O(1)

		if (keyIndex === -1) {
			throw createException(ErrorCodes.NOT_FOUND, `Attempt to delete key ${key} which isn't tracked. `);
		}

		this.doDelete(keyIndex);
	}

	public onClear(): void {
		this.expirableKeys.clear();
		this.synchronize();
	}

	public isIdle(): boolean {
		return this.cleanUpInterval == null;
	}

	private findKeyIndex(key: Key): number {
		const equals = (item: ExpirableCacheKeyEntry<Key, Value>): boolean => item.key === key;
		return this.expirableKeys.findIndex(equals);
	}

	private decorateEntry(entry: ExpirableCacheKeyEntry<Key, Value>, key: Key): void {
		// @ts-ignore
		entry.key = key;
	}

	private doDelete(keyIndex: number): void {
		// root might be removed, or heap structure might change, we need to sync with new root
		// on multiple keys with same `expiresAt` won't start timer
		// it will be started only when root value changes `for real`
		this.expirableKeys.remove(keyIndex);
		this.synchronize();
	}

	private doScheduleDelete(expirableKey: ExpirableCacheKeyEntry<Key, Value>): void {
		this.expirableKeys.push(expirableKey);
		this.synchronize();
	}

	/**
	 * This method synchronizes garbage collection
	 * It needs to be called every time expirable keys heap is altered.
	 */
	private synchronize(): void {
		const rootKey = this.expirableKeys.peek();

		if (rootKey === undefined) {
			if (!this.isIdle()) {
				this.shutdown();
			}
			return;
		}

		if (this.cleanUpInterval == null) {
			return this.doStart(rootKey[EXPIRES_AT_SYM]);
		}

		if (this.cleanUpInterval.willCleanUpOn !== rootKey[EXPIRES_AT_SYM]) {
			clearTimeout(this.cleanUpInterval.timeoutId);
			this.start(rootKey[EXPIRES_AT_SYM] - chrono.unixTime(), rootKey[EXPIRES_AT_SYM]);
		}
	}

	private shutdown(): void {
		clearTimeout(this.cleanUpInterval!.timeoutId);
		this.cleanUpInterval = null;
	}

	private doStart(willCleanUpOn: UnixTimestamp): void {
		// @ts-ignore
		this.cleanUpInterval = {};

		const runDelay = willCleanUpOn - chrono.unixTime();
		this.start(runDelay, willCleanUpOn);
	}

	private start(runDelay: Seconds, willCleanUpOn: UnixTimestamp): void {
		this.cleanUpInterval!.willCleanUpOn = willCleanUpOn;
		this.cleanUpInterval!.timeoutId = setTimeout(this.doCleanUp, runDelay * 1000);
	}

	private doCleanUp = (): void => {
		let toDelete = this.expirableKeys.peek();

		if (toDelete === undefined) {
			throw createException(
				ErrorCodes.BAD_INVARIANT,
				`Clean up handler has been invoked, but expirable keys heap is empty. Scheduling had been made for ${this.cleanUpInterval!.willCleanUpOn}`
			);
		}

		const rootKeyExpiresAt = toDelete[EXPIRES_AT_SYM];

		do {
			this.delete(toDelete.key); /// removal from heap will be made by `onDelete` hook
			toDelete = this.expirableKeys.peek();
			if (toDelete && toDelete[EXPIRES_AT_SYM] !== rootKeyExpiresAt) {
				toDelete = undefined;
			}
		} while (toDelete !== undefined);
	};
}

export { ProactiveExpirationPolicy, ExpirableCacheKeyEntry };
