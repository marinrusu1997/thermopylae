import { ErrorCodes, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { EXPIRES_AT_SYM } from '../../constants';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/cache-replacement-policy';
import { createException } from '../../error';

/**
 * @internal
 */
interface ExpirableCacheEntry<Key, Value> extends CacheEntry<Value>, CacheKey<Key> {
	[EXPIRES_AT_SYM]?: UnixTimestamp;
}

abstract class AbstractExpirationPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * Cache entry deleter.
	 */
	protected deleteFromCache!: Deleter<Key, Value>;

	abstract onGet(key: Key, entry: CacheEntry<Value>): EntryValidity;

	abstract onSet(key: Key, entry: CacheEntry<Value>, argsBundle?: ArgumentsBundle): void;

	abstract onUpdate(key: Key, entry: CacheEntry<Value>, argsBundle?: ArgumentsBundle): void;

	/**
	 * @inheritDoc
	 */
	public onDelete(_key: Key, entry: ExpirableCacheEntry<Key, Value>): void {
		entry[EXPIRES_AT_SYM] = undefined!; // detach metadata, as entry might be reused by cache backend, logical deletion
	}

	abstract onClear(): void;

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	protected static setEntryExpiration<K, V>(entry: ExpirableCacheEntry<K, V>, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
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
		if (expiresAt < now) {
			// we can tolerate such small deviations (they are very rare), and evict item immediately after it was set
			expiresAt = now;
		}

		entry[EXPIRES_AT_SYM] = expiresAt;
	}
}

export { AbstractExpirationPolicy, ExpirableCacheEntry };
