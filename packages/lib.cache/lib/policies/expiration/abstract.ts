import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { CacheEntry } from '../../contracts/commons';
import { EXPIRES_AT_SYM } from '../../constants';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/cache-replacement-policy';
import { createException, ErrorCodes } from '../../error';

/**
 * @private
 */
interface ExpirableCacheEntry<Key, Value> extends CacheEntry<Key, Value> {
	[EXPIRES_AT_SYM]?: UnixTimestamp;
}

/**
 * @private
 */
abstract class AbstractExpirationPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * Cache entry deleter.
	 */
	protected deleteFromCache!: Deleter<Key, Value>;

	/**
	 * @inheritDoc
	 */
	abstract onHit(entry: CacheEntry<Key, Value>): EntryValidity;

	/**
	 * @inheritDoc
	 */
	public onMiss(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	abstract onSet(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void;

	/**
	 * @inheritDoc
	 */
	abstract onUpdate(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void;

	/**
	 * @inheritDoc
	 */
	public onDelete(entry: ExpirableCacheEntry<Key, Value>): void {
		entry[EXPIRES_AT_SYM] = undefined!; // detach metadata, as entry might be reused by cache backend, logical deletion
	}

	/**
	 * @inheritDoc
	 */
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
			throw createException(ErrorCodes.INVALID_EXPIRES_AFTER, `'expiresAfter' needs to be an integer. Given: ${expiresAfter}.`);
		}

		const now = chrono.unixTime();
		let expiresAt: UnixTimestamp;

		if (expiresFrom != null) {
			if (!Number.isInteger(expiresFrom)) {
				throw createException(ErrorCodes.INVALID_EXPIRES_FROM, `'expiresFrom' needs to be an integer. Given: ${expiresFrom}.`);
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
