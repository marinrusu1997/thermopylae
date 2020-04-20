import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { Heap } from '@thermopylae/lib.collections';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy } from './abstract-expiration-policy';
import { Deleter } from '../expiration-policy';

interface TrackedItem<Key = string> {
	whenToDelete: number;
	key: Key;
}

interface CleanUpSprint {
	timeoutId: NodeJS.Timeout;
	willRunOn: UnixTimestamp;
}

class HighResolutionExpirationPolicy<Key = string> extends AbstractExpirationPolicy<Key> {
	private readonly trackedItems: Heap<TrackedItem<Key>>;

	private cleanUpSprint: CleanUpSprint | null;

	constructor(deleter: Deleter<Key>) {
		super(deleter);

		this.trackedItems = new Heap<TrackedItem<Key>>((first, second) => {
			if (first.whenToDelete < second.whenToDelete) {
				return -1;
			}
			if (first.whenToDelete > second.whenToDelete) {
				return 1;
			}
			return 0;
		});
		this.cleanUpSprint = null;
	}

	public expires(key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null {
		const expires = super.expires(key, after, from);
		if (expires === null) {
			return null;
		}

		const item = { key, whenToDelete: expires };
		this.doScheduleDelete(item);

		return null;
	}

	public updateExpires(key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null {
		const newExpires = super.updateExpires(key, after, from);
		if (newExpires === null) {
			throw new Error('REMOVING OLD TIMER IS NOT SUPPORTED FOR NOW');
		}

		const update: TrackedItem<Key> = { key, whenToDelete: newExpires };

		if (this.trackedItems.updateItem(update, item => item.key === key) !== undefined) {
			this.synchronize();
			return newExpires;
		}

		// this is an update of item which had infinite timeout
		this.doScheduleDelete(update);
		return null;
	}

	public expired(_key: Key, _expires: UnixTimestamp | null): boolean {
		// FIXME ideal scenario: we check expires, clear item, clear timer
		//  but due to timer clear performance issues, we will return always false,
		//  as deletion will be done automatically by timer
		return false;
	}

	public resetExpires(): void {
		if (!this.isIdle()) {
			this.shutdown();
		}
		this.trackedItems.clear();
	}

	private doScheduleDelete(item: TrackedItem<Key>): void {
		this.trackedItems.push(item);

		if (this.isIdle()) {
			return this.doStart(item.whenToDelete);
		}

		return this.synchronize();
	}

	private synchronize(): void {
		const root = this.trackedItems.peek()!;
		if (this.cleanUpSprint!.willRunOn !== root.whenToDelete) {
			clearTimeout(this.cleanUpSprint!.timeoutId);
			this.start(root.whenToDelete - chrono.dateToUNIX(), root.whenToDelete);
		}
	}

	private shutdown(): void {
		clearTimeout(this.cleanUpSprint!.timeoutId);
		this.cleanUpSprint = null;
	}

	private doStart(willRunOn: UnixTimestamp): void {
		// @ts-ignore
		this.cleanUpSprint = {};

		const runDelay = willRunOn - chrono.dateToUNIX();
		this.start(runDelay, willRunOn);
	}

	private start(runDelay: Seconds, willRunOn: UnixTimestamp): void {
		this.cleanUpSprint!.willRunOn = willRunOn;
		this.cleanUpSprint!.timeoutId = setTimeout(this.doCleanUp, runDelay * 1000);
	}

	private isIdle(): boolean {
		return this.cleanUpSprint === null;
	}

	private doCleanUp = (): void => {
		let itemToDelete = this.trackedItems.peek(); // if we were invoked it is clear that first item needs to be deleted

		const whenToDeleteOfRootItem = itemToDelete!.whenToDelete;

		do {
			this.delete(itemToDelete!.key);
			this.trackedItems.pop();
			itemToDelete = this.trackedItems.peek();
			if (itemToDelete && itemToDelete.whenToDelete !== whenToDeleteOfRootItem) {
				itemToDelete = undefined;
			}
		} while (itemToDelete !== undefined);

		itemToDelete = this.trackedItems.peek();

		if (itemToDelete !== undefined) {
			this.start(itemToDelete.whenToDelete - chrono.dateToUNIX(), itemToDelete.whenToDelete);
		} else {
			this.cleanUpSprint = null;
		}
	};
}

export { HighResolutionExpirationPolicy };
