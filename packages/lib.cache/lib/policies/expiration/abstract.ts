import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { createException, ErrorCodes } from '../../error';
import { INFINITE_TTL } from '../../constants';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';

/**
 * @internal
 */
const EXPIRES_AT_SYM = Symbol.for('EXPIRES_AT_SYM');

/**
 * @internal
 */
interface ExpirableCacheEntry<Value> extends CacheEntry<Value> {
	[EXPIRES_AT_SYM]?: UnixTimestamp;
}

/**
 * @internal
 */
interface ExpirableCacheKeyedEntry<Key, Value> extends CacheKey<Key>, ExpirableCacheEntry<Value> {}

interface AbstractExpirationPolicyArgumentsBundle {
	/**
	 * Time to live for `key` in {@link Seconds}. <br>
	 * Use {@link INFINITE_TTL} or omit this option to specify that the key should not expire. <br/>
	 * -----------------------------------------------------
	 * When ttl is updated, depending on the value of `expiresAfter` param, following behaviours will occur: <br/>
	 *
	 * Value						| Behaviour
	 * ---------------------------- | -------------------------------
	 * `undefined`  				| New value has no ttl and will never expire.
	 * {@link INFINITE_TTL}  		| New value has no ttl and will never expire.
	 * ttl of old value				| New value inherits ttl of the old value. Notice that timer is not reset, meaning that if old value remains to live `x` seconds, the new one will remain same `x` seconds.
	 * ttl different from old value	| New value has new ttl. Timer of old value is reset, so that new value remains to live `expiresAfter` seconds.
	 */
	expiresAfter?: Seconds;
	/**
	 * Timestamp from when ttl starts counting in {@link Seconds} as {@link UnixTimestamp}. <br/>
	 * Defaults to current unix timestamp when `expiresAfter` is given.
	 */
	expiresFrom?: UnixTimestamp;
}

abstract class AbstractExpirationPolicy<Key, Value, ArgumentsBundle extends AbstractExpirationPolicyArgumentsBundle>
	implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * Cache entry deleter.
	 */
	protected deleteFromCache!: Deleter<Key, Value>;

	/**
	 * @inheritDoc
	 */
	public onHit(key: Key, entry: ExpirableCacheEntry<Value>): EntryValidity {
		return this.evictIfExpired(key, entry);
	}

	/**
	 * @inheritDoc
	 */
	public onSet(_key: Key, entry: ExpirableCacheEntry<Value>, options?: ArgumentsBundle): void {
		if (options == null) {
			return;
		}

		if (AbstractExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		AbstractExpirationPolicy.setEntryExpiration(entry, options.expiresAfter!, options.expiresFrom);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(_key: Key, entry: ExpirableCacheEntry<Value>, options?: ArgumentsBundle): void {
		if (options == null || AbstractExpirationPolicy.isNonExpirable(options)) {
			entry[EXPIRES_AT_SYM] = undefined!; // entry is no longer expirable, logical deletion
			return;
		}
		AbstractExpirationPolicy.setEntryExpiration(entry, options.expiresAfter!, options.expiresFrom); // overwrites or adds expiration
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(_key: Key, entry: ExpirableCacheEntry<Value>): void {
		entry[EXPIRES_AT_SYM] = undefined!; // detach metadata, as entry might be reused by cache backend, logical deletion
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
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	protected evictIfExpired(key: Key, entry: ExpirableCacheEntry<Value>): EntryValidity {
		const expired = entry[EXPIRES_AT_SYM] != null ? entry[EXPIRES_AT_SYM]! <= chrono.unixTime() : false;
		if (expired) {
			this.deleteFromCache(key, entry); // metadata will be cleared by `onDelete` hook which is called by cache deleter
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
		if (expiresAt < now) {
			if (now - expiresAt > 2) {
				// (might happen because unixTime() is rounded, so it can be rounded to next second, i.e. in 1-2 second ttl scenario)
				throw createException(ErrorCodes.INVALID_VALUE, `'expiresAt' ${expiresAt} is lower than current time ${now}.`);
			}
			// we can tolerate such small deviations (they are very rare), and evict item immediately after it was set
			expiresAt = now;
		}

		entry[EXPIRES_AT_SYM] = expiresAt;
	}

	protected static isNonExpirable(argumentsBundle: AbstractExpirationPolicyArgumentsBundle): boolean {
		return argumentsBundle.expiresAfter == null || argumentsBundle.expiresAfter === INFINITE_TTL;
	}
}

export { AbstractExpirationPolicy, AbstractExpirationPolicyArgumentsBundle, ExpirableCacheEntry, ExpirableCacheKeyedEntry, EXPIRES_AT_SYM };
