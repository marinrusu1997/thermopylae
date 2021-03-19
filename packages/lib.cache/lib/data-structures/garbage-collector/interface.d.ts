import { UnixTimestamp } from '@thermopylae/core.declarations';
import { EXPIRES_AT_SYM } from '../../constants';

/**
 * Callback invoked when entry expires.
 */
declare type EntryExpiredCallback<T> = (entry: T) => void;

declare interface ExpirableEntry {
	[EXPIRES_AT_SYM]: UnixTimestamp;
}

/**
 * Garbage Collector manages expiration for a set of entries.
 *
 * @template T  Type of the entry.
 */
declare interface GarbageCollector<T extends ExpirableEntry> {
	/**
	 * Manage entry expiration.
	 *
	 * @param entry		Entry to be managed.
	 */
	manage(entry: T): void;

	/**
	 * Check if *entry* is managed by GC.
	 *
	 * @param entry		Entry to be checked.
	 */
	isManaged(entry: T): boolean;

	/**
	 * Notify GC about expiration change of the managed entry.
	 *
	 * @param oldExpiration		Old expiration of the *entry*.
	 * @param entry				Managed entry containing new expiration.
	 */
	update(oldExpiration: UnixTimestamp, entry: T): void;

	/**
	 * Leaves entry without expiration, by un-managing it.
	 *
	 * @param entry		Entry to be un-managed.
	 */
	leave(entry: T): void;

	/**
	 * Clear all managed entries.
	 */
	clear(): void;

	/**
	 * Register callback invoked when entry expires.
	 *
	 * @param cb	Callback.
	 */
	setEntryExpiredCallback(cb: EntryExpiredCallback<T>): void;

	/**
	 * Number of managed entries.
	 */
	size: number;

	/**
	 * Whether GC is idle.
	 */
	idle: boolean;
}

export { GarbageCollector, ExpirableEntry, EntryExpiredCallback };
