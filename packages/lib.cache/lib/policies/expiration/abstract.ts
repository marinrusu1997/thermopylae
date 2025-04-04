import { type Seconds, type UnixTimestamp, UnixTimestampC } from '@thermopylae/core.declarations';
import { chrono, types } from '@thermopylae/lib.utils';
import { EXPIRES_AT_SYM } from '../../constants.js';
import { ErrorCodes, createException } from '../../error.js';
import type { ExpirableEntry } from '../../garbage-collectors/interface.js';
import type { CacheReplacementPolicy, Deleter, EntryValidity } from '../../typings/cache-replacement-policy.js';
import type { CacheEntry } from '../../typings/commons.js';

/** @private */
interface ExpirableCacheEntry<Key, Value> extends CacheEntry<Key, Value>, ExpirableEntry {}

/** @private */
abstract class AbstractExpirationPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/** Cache entry deleter. */
	protected deleteFromCache!: Deleter<Key, Value>;

	/** @inheritdoc */
	abstract onHit(entry: CacheEntry<Key, Value>): EntryValidity;

	/** @inheritdoc */
	public onMiss(): void {
		return undefined;
	}

	/** @inheritdoc */
	abstract onSet(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void;

	/** @inheritdoc */
	abstract onUpdate(entry: CacheEntry<Key, Value>, argsBundle?: ArgumentsBundle): void;

	/** @inheritdoc */
	public onDelete(entry: ExpirableCacheEntry<Key, Value>): void {
		entry[EXPIRES_AT_SYM] = types.SOFT_DELETE; // detach metadata, as entry might be reused by cache backend, logical deletion
	}

	/** @inheritdoc */
	abstract onClear(): void;

	/** @inheritdoc */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	protected static setEntryExpiration<K, V>(entry: ExpirableCacheEntry<K, V>, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		// we check them only for integer, as values are checked implicitly for expiresAt, because we sum them

		if (!Number.isInteger(expiresAfter)) {
			throw createException(ErrorCodes.INVALID_EXPIRES_AFTER, `'expiresAfter' needs to be an integer. Given: ${expiresAfter}.`);
		}

		const now = chrono.unix();
		let expiresAt: UnixTimestamp | null = null;

		if (expiresFrom == null) {
			expiresAt = UnixTimestampC(now + expiresAfter);
		} else {
			if (!Number.isInteger(expiresFrom)) {
				throw createException(ErrorCodes.INVALID_EXPIRES_FROM, `'expiresFrom' needs to be an integer. Given: ${expiresFrom}.`);
			}

			expiresAt = UnixTimestampC(expiresFrom + expiresAfter);
		}

		// in case they are equal, item should be immediately evicted
		if (expiresAt < now) {
			// we can tolerate such small deviations (they are very rare), and evict item immediately after it was set
			expiresAt = now;
		}

		entry[EXPIRES_AT_SYM] = expiresAt;
	}
}

export { AbstractExpirationPolicy, type ExpirableCacheEntry };
