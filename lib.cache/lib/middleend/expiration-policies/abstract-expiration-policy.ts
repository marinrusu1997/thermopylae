import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { ExpirableCacheEntry, ExpirationPolicy } from '../../contracts/sync/expiration-policy';
import { createException, ErrorCodes } from '../../error';
import { INFINITE_TTL } from '../../constants';
import { Deleter } from '../../contracts/sync/cache-policy';

abstract class AbstractExpirationPolicy<Key, Value, Entry extends ExpirableCacheEntry<Value> = ExpirableCacheEntry<Value>>
	implements ExpirationPolicy<Key, Value, Entry> {
	protected delete!: Deleter<Key>;

	get requiresEntryOnDeletion(): boolean {
		return false;
	}

	public onSet(_key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		if (expiresAfter === INFINITE_TTL) {
			return;
		}
		this.setEntryExpiration(entry, expiresAfter, expiresFrom);
	}

	public onUpdate(_key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		if (expiresAfter === INFINITE_TTL) {
			delete entry.expiresAt;
			return;
		}
		this.setEntryExpiration(entry, expiresAfter, expiresFrom);
	}

	public removeIfExpired(key: Key, entry: Entry): boolean {
		return this.doRemovalIfExpired(key, entry.expiresAt);
	}

	public onDelete(_key: Key, _entry?: Entry): void {
		return undefined; // just do nothing
	}

	public onClear(): void {
		return undefined; // just do nothing
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	protected doRemovalIfExpired(key: Key, expiration?: UnixTimestamp | null): boolean {
		const expired = expiration != null ? expiration >= chrono.dateToUNIX() : false;
		if (expired) {
			this.delete(key);
		}
		return expired;
	}

	protected setEntryExpiration(entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		const now = chrono.dateToUNIX();
		const expiresAt = (expiresFrom || now) + expiresAfter;

		AbstractExpirationPolicy.assertValidExpiresAt(entry.expiresAt, expiresAt, now);

		entry.expiresAt = expiresAt;
	}

	private static assertValidExpiresAt(oldExpiration: UnixTimestamp | undefined, newExpiration: UnixTimestamp, now: UnixTimestamp): void {
		if (newExpiration <= now) {
			throw createException(ErrorCodes.INVALID_EXPIRATION, `New expiration ${newExpiration} (UNIX) is lower or equal than current time ${now} (UNIX). `);
		}

		if (oldExpiration != null && oldExpiration === newExpiration) {
			throw createException(ErrorCodes.INVALID_EXPIRATION, `New expiration ${newExpiration} (UNIX) is the same as the old one ${oldExpiration} (UNIX). `);
		}
	}
}

export { AbstractExpirationPolicy };
