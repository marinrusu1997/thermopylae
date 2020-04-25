import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { Heap } from '@thermopylae/lib.collections';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy } from './abstract-expiration-policy';
import { ExpirableCacheKey } from '../contracts/cache';
import { createException, ErrorCodes } from '../error';

interface CleanUpSprint {
	timeoutId: NodeJS.Timeout;
	willCleanUpOn: UnixTimestamp;
}

class HighResolutionExpirationPolicy<Key = string> extends AbstractExpirationPolicy<Key> {
	private readonly expirableKeys: Heap<ExpirableCacheKey<Key>>;

	private cleanUpSprint: CleanUpSprint | null;

	constructor() {
		super();

		this.expirableKeys = new Heap<ExpirableCacheKey<Key>>((first, second) => {
			if (first.expiresAt! < second.expiresAt!) {
				return -1;
			}
			if (first.expiresAt! > second.expiresAt!) {
				return 1;
			}
			return 0;
		});
		this.cleanUpSprint = null;
	}

	public expiresAt(key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null {
		const expiresAt = super.expiresAt(key, expiresAfter, expiresFrom);
		if (expiresAt === null) {
			return null;
		}

		const expirableKey = { key, expiresAt };
		this.doScheduleDelete(expirableKey);

		return null;
	}

	public updateExpiresAt(key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null {
		const expiresAt = super.expiresAt(key, expiresAfter, expiresFrom);
		if (expiresAt === null) {
			throw new Error('REMOVING OLD TIMER IS NOT SUPPORTED FOR NOW');
		}

		const expirableKeyUpdate = { key, expiresAt };

		if (this.expirableKeys.updateItem(expirableKeyUpdate, item => item.key === key) !== undefined) {
			this.synchronize();
			return null;
		}

		// this is an update of item which had infinite timeout
		this.doScheduleDelete(expirableKeyUpdate);
		return null;
	}

	public isExpired(): boolean {
		// FIXME ideal scenario: we check expiresAt, clear item, clear timer
		//  but due to timer clear performance issues, we will return always false,
		//  as deletion will be done automatically by timer
		return false;
	}

	public isIdle(): boolean {
		return this.cleanUpSprint === null;
	}

	public onDelete(): void {
		throw createException(ErrorCodes.OPERATION_NOT_SUPPORTED, 'Delete is not supported');
	}

	public onClear(): void {
		if (!this.isIdle()) {
			this.shutdown();
		}
		this.expirableKeys.clear();
	}

	private doScheduleDelete(expirableKey: ExpirableCacheKey<Key>): void {
		this.expirableKeys.push(expirableKey);

		if (this.isIdle()) {
			return this.doStart(expirableKey.expiresAt!);
		}

		return this.synchronize();
	}

	private synchronize(): void {
		const rootKey = this.expirableKeys.peek()!;
		if (this.cleanUpSprint!.willCleanUpOn !== rootKey.expiresAt) {
			clearTimeout(this.cleanUpSprint!.timeoutId);
			this.start(rootKey.expiresAt! - chrono.dateToUNIX(), rootKey.expiresAt!);
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
			this.start(toDelete.expiresAt! - chrono.dateToUNIX(), toDelete.expiresAt!);
		} else {
			this.cleanUpSprint = null;
		}
	};
}

export { HighResolutionExpirationPolicy };
