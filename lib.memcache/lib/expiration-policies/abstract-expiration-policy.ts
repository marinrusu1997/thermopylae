import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { Deleter, ExpirationPolicy } from '../contracts/expiration-policy';
import { createException, ErrorCodes } from '../error';
import { INFINITE_TTL } from '../contracts/cache';

abstract class AbstractExpirationPolicy<Key = string> implements ExpirationPolicy<Key> {
	protected delete!: Deleter<Key>;

	public expires(_key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null {
		if (after === INFINITE_TTL) {
			return null;
		}

		const now = chrono.dateToUNIX();
		const expires = (from || now) + after;

		this.guardValidExpires(expires, now);

		return expires;
	}

	public updateExpires(key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null {
		return this.expires(key, after, from);
	}

	public expired(key: Key, expires: UnixTimestamp | null): boolean {
		const expired = expires !== null ? expires >= chrono.dateToUNIX() : false;
		if (expired) {
			this.delete(key);
		}
		return expired;
	}

	public resetExpires(): void {
		return undefined; // just do nothing
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	private guardValidExpires(expires: UnixTimestamp, now: UnixTimestamp): void {
		if (expires <= now) {
			throw createException(ErrorCodes.INVALID_EXPIRES, `New expires ${expires} (UNIX) is lower or equal than current time ${now} (UNIX). `);
		}
	}
}

export { AbstractExpirationPolicy };
