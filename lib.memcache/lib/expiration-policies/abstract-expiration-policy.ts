import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { Deleter, ExpirationPolicy } from '../contracts/expiration-policy';
import { createException, ErrorCodes } from '../error';
import { INFINITE_TTL } from '../contracts/cache';

abstract class AbstractExpirationPolicy<Key = string> implements ExpirationPolicy<Key> {
	protected delete!: Deleter<Key>;

	public onSet(_key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null {
		if (expiresAfter === INFINITE_TTL) {
			return null;
		}

		const now = chrono.dateToUNIX();
		const expiresAt = (expiresFrom || now) + expiresAfter;

		this.guardValidExpiresAt(expiresAt, now);

		return expiresAt;
	}

	public onUpdate(key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null {
		return this.onSet(key, expiresAfter, expiresFrom);
	}

	public isExpired(key: Key, expiresAt: UnixTimestamp | null): boolean {
		const expired = expiresAt !== null ? expiresAt >= chrono.dateToUNIX() : false;
		if (expired) {
			this.delete(key);
		}
		return expired;
	}

	public onClear(): void {
		return undefined; // just do nothing
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	private guardValidExpiresAt(expiresAt: UnixTimestamp, now: UnixTimestamp): void {
		if (expiresAt <= now) {
			throw createException(ErrorCodes.INVALID_EXPIRES_AT, `New expiresAt ${expiresAt} (UNIX) is lower or equal than current time ${now} (UNIX). `);
		}
	}
}

export { AbstractExpirationPolicy };
