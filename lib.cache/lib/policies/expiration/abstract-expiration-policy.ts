import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { createException, ErrorCodes } from '../../error';
import { INFINITE_TTL } from '../../constants';
import { CachePolicy, Deleter, EntryValidity, SetOperationContext } from '../../contracts/sync/cache-policy';
import { CacheEntry } from '../../contracts/sync/cache-backend';

const EXPIRES_AT_SYM = Symbol.for('EXPIRES_AT_SYM');

interface ExpirableCacheEntry<Value> extends CacheEntry<Value> {
	[EXPIRES_AT_SYM]?: UnixTimestamp;
}

abstract class AbstractExpirationPolicy<Key, Value> implements CachePolicy<Key, Value> {
	protected delete!: Deleter<Key>;

	public onGet(key: Key, entry: ExpirableCacheEntry<Value>): EntryValidity {
		return this.doRemovalIfExpired(key, entry[EXPIRES_AT_SYM]);
	}

	public onSet(_key: Key, entry: ExpirableCacheEntry<Value>, context: SetOperationContext): void {
		if (context.expiresAfter == null || context.expiresAfter === INFINITE_TTL) {
			return;
		}
		this.setEntryExpiration(entry, context.expiresAfter, context.expiresFrom);
	}

	public onUpdate(_key: Key, entry: ExpirableCacheEntry<Value>, context: SetOperationContext): void {
		if (context.expiresAfter == null || context.expiresAfter === INFINITE_TTL) {
			delete entry[EXPIRES_AT_SYM];
			return;
		}
		this.setEntryExpiration(entry, context.expiresAfter, context.expiresFrom);
	}

	public onDelete(_key: Key, _entry?: ExpirableCacheEntry<Value>): void {
		return undefined; // just do nothing
	}

	public onClear(): void {
		return undefined; // just do nothing
	}

	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	public get requiresEntryOnDeletion(): boolean {
		return false;
	}

	protected doRemovalIfExpired(key: Key, expiration?: UnixTimestamp | null): EntryValidity {
		const expired = expiration != null ? expiration >= chrono.dateToUNIX() : false;
		if (expired) {
			this.delete(key);
			return EntryValidity.NOT_VALID;
		}
		return EntryValidity.VALID;
	}

	protected setEntryExpiration(entry: ExpirableCacheEntry<Value>, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		const now = chrono.dateToUNIX();
		const expiresAt = (expiresFrom || now) + expiresAfter;

		AbstractExpirationPolicy.assertValidExpiresAt(entry[EXPIRES_AT_SYM], expiresAt, now);

		entry[EXPIRES_AT_SYM] = expiresAt;
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

export { AbstractExpirationPolicy, ExpirableCacheEntry, EXPIRES_AT_SYM };
