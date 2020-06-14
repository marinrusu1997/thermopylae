import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { Heap } from '@thermopylae/lib.collections';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy } from './abstract-expiration-policy';
import { CacheKey } from '../contracts/cache';
import { createException, ErrorCodes } from '../error';
import { ExpirableCacheEntry } from '../contracts/expiration-policy';
import { INFINITE_TTL } from '../constants';

interface CleanUpSprint {
	timeoutId: NodeJS.Timeout;
	willCleanUpOn: UnixTimestamp;
}

interface ExpirableCacheKeyEntry<Key, Value> extends CacheKey<Key>, ExpirableCacheEntry<Value> {
	expiresAt: UnixTimestamp;
}

class HighResolutionExpirationPolicy<
	Key,
	Value,
	Entry extends ExpirableCacheEntry<Value> = ExpirableCacheKeyEntry<Key, Value>
> extends AbstractExpirationPolicy<Key, Value, Entry> {
	private readonly expirableKeys: Heap<ExpirableCacheKeyEntry<Key, Value>>;

	private cleanUpSprint: CleanUpSprint | null;

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
		this.cleanUpSprint = null;
	}

	public onSet(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		if (expiresAfter === INFINITE_TTL) {
			return;
		}

		super.setEntryExpiration(entry, expiresAfter, expiresFrom);
		// @ts-ignore
		entry.key = key;

		this.doScheduleDelete((entry as unknown) as ExpirableCacheKeyEntry<Key, Value>);
	}

	public onUpdate(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		super.onUpdate(key, entry, expiresAfter, expiresFrom);
		if (!entry.expiresAt) {
			throw createException(ErrorCodes.INVALID_EXPIRATION, 'Removing old timer is not supported for now. ');
		}

		const equals = (item: ExpirableCacheKeyEntry<Key, Value>): boolean => item.key === key;
		if (this.expirableKeys.updateItem((entry as unknown) as ExpirableCacheKeyEntry<Key, Value>, equals) !== undefined) {
			return this.synchronize();
		}

		// this is an update of item which had infinite timeout
		this.doScheduleDelete((entry as unknown) as ExpirableCacheKeyEntry<Key, Value>);
	}

	public removeIfExpired(): boolean {
		// FIXME here we should find and remove item from heap, but it would be to expensive to do on each get
		return false;
	}

	public onDelete(): void {
		// FIXME here we can delete item from heap, performance issues should not be problematic
		throw createException(ErrorCodes.OPERATION_NOT_SUPPORTED, 'Delete is not supported. ');
	}

	public onClear(): void {
		if (!this.isIdle()) {
			this.shutdown();
		}
		this.expirableKeys.clear();
	}

	public isIdle(): boolean {
		return this.cleanUpSprint == null;
	}

	private doScheduleDelete(expirableKey: ExpirableCacheKeyEntry<Key, Value>): void {
		this.expirableKeys.push(expirableKey);

		if (this.isIdle()) {
			return this.doStart(expirableKey.expiresAt);
		}

		return this.synchronize();
	}

	private synchronize(): void {
		const rootKey = this.expirableKeys.peek()!;
		if (this.cleanUpSprint!.willCleanUpOn !== rootKey.expiresAt) {
			clearTimeout(this.cleanUpSprint!.timeoutId);
			this.start(rootKey.expiresAt - chrono.dateToUNIX(), rootKey.expiresAt);
		}
	}

	private shutdown(): void {
		clearTimeout(this.cleanUpSprint!.timeoutId);
		this.cleanUpSprint = null;
	}

	private doStart(willCleanUpOn: UnixTimestamp): void {
		// @ts-ignore
		this.cleanUpSprint = {};

		const runDelay = willCleanUpOn - chrono.dateToUNIX();
		this.start(runDelay, willCleanUpOn);
	}

	private start(runDelay: Seconds, willCleanUpOn: UnixTimestamp): void {
		this.cleanUpSprint!.willCleanUpOn = willCleanUpOn;
		this.cleanUpSprint!.timeoutId = setTimeout(this.doCleanUp, runDelay * 1000);
	}

	private doCleanUp = (): void => {
		let toDelete = this.expirableKeys.peek(); // if we were invoked it is clear that first item needs to be deleted

		const rootKeyExpiresAt = toDelete!.expiresAt;

		do {
			this.delete(toDelete!.key);
			this.expirableKeys.pop();
			toDelete = this.expirableKeys.peek();
			if (toDelete && toDelete.expiresAt !== rootKeyExpiresAt) {
				toDelete = undefined;
			}
		} while (toDelete !== undefined);

		toDelete = this.expirableKeys.peek();

		if (toDelete !== undefined) {
			this.start(toDelete.expiresAt - chrono.dateToUNIX(), toDelete.expiresAt);
		} else {
			this.cleanUpSprint = null;
		}
	};
}

export { HighResolutionExpirationPolicy };
