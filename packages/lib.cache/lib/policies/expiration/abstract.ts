import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { createException, ErrorCodes } from '../../error';
import { INFINITE_TTL } from '../../constants';
import { CacheReplacementPolicy, Deleter, EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';
import { CacheEntry } from '../../contracts/commons';

const EXPIRES_AT_SYM = Symbol.for('EXPIRES_AT_SYM');

interface ExpirableCacheEntry<Value> extends CacheEntry<Value> {
	[EXPIRES_AT_SYM]?: UnixTimestamp;
}

abstract class AbstractExpirationPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	protected delete!: Deleter<Key>;

	/**
	 * @inheritDoc
	 */
	public onHit(key: Key, entry: ExpirableCacheEntry<Value>): EntryValidity {
		return this.evictIfExpired(key, entry);
	}

	/**
	 * @inheritDoc
	 */
	public onMiss(_key: Key): void {
		return undefined; // eslint
	}

	/**
	 * @inheritDoc
	 */
	public onSet(_key: Key, entry: ExpirableCacheEntry<Value>, context: SetOperationContext): void {
		if (AbstractExpirationPolicy.isNonExpirable(context)) {
			return;
		}
		AbstractExpirationPolicy.setEntryExpiration(entry, context.expiresAfter!, context.expiresFrom);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(_key: Key, entry: ExpirableCacheEntry<Value>, context: SetOperationContext): void {
		if (AbstractExpirationPolicy.isNonExpirable(context)) {
			delete entry[EXPIRES_AT_SYM]; // maybe previously it had ttl
			return;
		}
		AbstractExpirationPolicy.setEntryExpiration(entry, context.expiresAfter!, context.expiresFrom); // overwrites or adds expiration
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(_key: Key, entry: ExpirableCacheEntry<Value>): void {
		delete entry[EXPIRES_AT_SYM]; // detach metadata, as entry might be reused by cache backend
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		// there is no need to clear metadata, backend entries should also be removed
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key>): void {
		this.delete = deleter;
	}

	public get requiresEntryOnDeletion(): boolean {
		return true;
	}

	protected evictIfExpired(key: Key, entry: ExpirableCacheEntry<Value>): EntryValidity {
		const expired = entry[EXPIRES_AT_SYM] != null ? entry[EXPIRES_AT_SYM]! <= chrono.unixTime() : false;
		if (expired) {
			this.delete(key);
			delete entry[EXPIRES_AT_SYM];
			return EntryValidity.NOT_VALID;
		}
		return EntryValidity.VALID;
	}

	protected static setEntryExpiration<V>(entry: ExpirableCacheEntry<V>, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		// we check them only for integer, as values are checked implicitly for expiresAt, because we sum them

		if (!Number.isInteger(expiresAfter)) {
			throw createException(ErrorCodes.INVALID_VALUE, `'expiresAfter' needs to be an integer. Given: ${expiresAfter}.`);
		}

		const now = chrono.unixTime();
		let expiresAt: UnixTimestamp;

		if (expiresFrom != null) {
			if (!Number.isInteger(expiresFrom)) {
				throw createException(ErrorCodes.INVALID_VALUE, `'expiresFrom' needs to be an integer. Given: ${expiresFrom}.`);
			}

			expiresAt = expiresFrom + expiresAfter;
		} else {
			expiresAt = now + expiresAfter;
		}

		// in case they are equal, item should be immediately evicted
		// (might happen because unixTime() is rounded, so it can be rounded to next second, i.e. in 1 second ttl scenario)
		if (expiresAt < now) {
			throw createException(ErrorCodes.INVALID_VALUE, `'expiresAt' ${expiresAt} is lower than current time ${now}.`);
		}

		entry[EXPIRES_AT_SYM] = expiresAt;
	}

	protected static isNonExpirable(context: SetOperationContext): boolean {
		return context.expiresAfter == null || context.expiresAfter === INFINITE_TTL;
	}
}

export { AbstractExpirationPolicy, ExpirableCacheEntry, EXPIRES_AT_SYM };
