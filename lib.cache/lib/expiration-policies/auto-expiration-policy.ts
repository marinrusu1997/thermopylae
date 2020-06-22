import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { Heap } from '@thermopylae/lib.collections';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy } from './abstract-expiration-policy';
import { CacheKey } from '../contracts/cache';
import { createException, ErrorCodes } from '../error';
import { ExpirableCacheEntry } from '../contracts/expiration-policy';
import { INFINITE_TTL } from '../constants';

interface CleanUpInterval {
	timeoutId: NodeJS.Timeout;
	willCleanUpOn: UnixTimestamp;
}

interface ExpirableCacheKeyEntry<Key, Value> extends CacheKey<Key>, ExpirableCacheEntry<Value> {
	expiresAt: UnixTimestamp;
}

class AutoExpirationPolicy<
	Key = string,
	Value = any,
	Entry extends ExpirableCacheEntry<Value> = ExpirableCacheKeyEntry<Key, Value>
> extends AbstractExpirationPolicy<Key, Value, Entry> {
	private readonly expirableKeys: Heap<ExpirableCacheKeyEntry<Key, Value>>;

	private cleanUpInterval: CleanUpInterval | null;

	constructor() {
		super();

		this.expirableKeys = new Heap<ExpirableCacheKeyEntry<Key, Value>>((first, second) => {
			if (first.expiresAt < second.expiresAt) {
				return -1;
			}
			if (first.expiresAt > second.expiresAt) {
				return 1;
			}
			return 0;
		});
		this.cleanUpInterval = null;
	}

	public onSet(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		if (expiresAfter === INFINITE_TTL) {
			return;
		}

		super.setEntryExpiration(entry, expiresAfter, expiresFrom);
		this.decorateEntry(entry, key);

		this.doScheduleDelete((entry as unknown) as ExpirableCacheKeyEntry<Key, Value>);
	}

	public onUpdate(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		const oldExpiration = entry.expiresAt;

		super.onUpdate(key, entry, expiresAfter, expiresFrom);

		const keyIndex = this.findKeyIndex(key);

		if (keyIndex !== -1) {
			if (entry.expiresAt == null) {
				// item was added with ttl, but now it's ttl became INFINITE
				return this.doDelete(keyIndex);
			}

			if (oldExpiration === entry.expiresAt) {
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

	public removeIfExpired(): boolean {
		// here we should find and remove item from heap, but it would be to expensive to do on each get
		return false;
	}

	public onDelete(key: Key): void {
		const keyIndex = this.findKeyIndex(key); // when key is root, find is O(1)

		if (keyIndex === -1) {
			throw createException(ErrorCodes.KEY_NOT_FOUND, `Attempt to delete key ${key} which isn't tracked. `);
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

	private decorateEntry(entry: Entry, key: Key): void {
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
			return this.doStart(rootKey.expiresAt);
		}

		if (this.cleanUpInterval.willCleanUpOn !== rootKey.expiresAt) {
			clearTimeout(this.cleanUpInterval.timeoutId);
			this.start(rootKey.expiresAt - chrono.dateToUNIX(), rootKey.expiresAt);
		}
	}

	private shutdown(): void {
		clearTimeout(this.cleanUpInterval!.timeoutId);
		this.cleanUpInterval = null;
	}

	private doStart(willCleanUpOn: UnixTimestamp): void {
		// @ts-ignore
		this.cleanUpInterval = {};

		const runDelay = willCleanUpOn - chrono.dateToUNIX();
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
				ErrorCodes.ABNORMAL_CONDITION,
				`Clean up handler has been invoked, but expirable keys heap is empty. Scheduling had been made for ${this.cleanUpInterval!.willCleanUpOn}`
			);
		}

		const rootKeyExpiresAt = toDelete.expiresAt;

		do {
			this.delete(toDelete.key); /// removal from heap will be made by `onDelete` hook
			toDelete = this.expirableKeys.peek();
			if (toDelete && toDelete.expiresAt !== rootKeyExpiresAt) {
				toDelete = undefined;
			}
		} while (toDelete !== undefined);
	};
}

export { AutoExpirationPolicy, ExpirableCacheKeyEntry };
