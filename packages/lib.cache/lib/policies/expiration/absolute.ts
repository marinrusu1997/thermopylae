import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../constants';
import { EntryValidity } from '../../contracts/cache-replacement-policy';
import { AbstractExpirationPolicy, ExpirableCacheEntry } from './abstract';

interface AbsoluteExpirationPolicyArgumentsBundle {
	/**
	 * Time to live for `key` in seconds. <br>
	 * When inserting the key, use {@link INFINITE_EXPIRATION} or omit this option to specify that the key should not expire. <br/>
	 * -----------------------------------------------------
	 * When ttl is updated, depending on the value of `expiresAfter` param, following behaviours will occur: <br/>
	 *
	 * Value						| Behaviour
	 * ---------------------------- | -------------------------------
	 * `undefined`  				| Entry ttl won't be updated and will remain the same.
	 * {@link INFINITE_EXPIRATION}  | Entry ttl is discarded, so that it will never expire.
	 * ttl of old value				| Entry ttl won't be updated and will remain the same. Notice that timer is not reset, meaning that if old value remains to live `x` seconds, it will be evicted after `x` seconds.
	 * ttl different from old value	| Entry ttl will be updated to the new ttl. Timer will be reset, so that new value remains to live `expiresAfter` seconds.
	 */
	expiresAfter?: Seconds;
	/**
	 * Timestamp from when ttl starts counting in seconds as Unix Timestamp. <br/>
	 * Defaults to current unix timestamp when `expiresAfter` is given.
	 */
	expiresFrom?: UnixTimestamp;
}

/**
 * @internal
 */
abstract class AbsoluteExpirationPolicy<Key, Value, ArgumentsBundle extends AbsoluteExpirationPolicyArgumentsBundle> extends AbstractExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle
> {
	/**
	 * @inheritDoc
	 */
	public onGet(key: Key, entry: ExpirableCacheEntry<Key, Value>): EntryValidity {
		return this.evictIfExpired(key, entry);
	}

	/**
	 * @inheritDoc
	 */
	public onSet(_key: Key, entry: ExpirableCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || AbsoluteExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		AbsoluteExpirationPolicy.setEntryExpiration(entry, options.expiresAfter!, options.expiresFrom);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(_key: Key, entry: ExpirableCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || options.expiresAfter == null) {
			return;
		}

		if (options.expiresAfter === INFINITE_EXPIRATION) {
			entry[EXPIRES_AT_SYM] = undefined!; // entry is no longer expirable, logical deletion
			return;
		}

		AbsoluteExpirationPolicy.setEntryExpiration(entry, options.expiresAfter!, options.expiresFrom); // overwrites or adds expiration
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		// there is no need to clear metadata, backend entries should also be removed
	}

	protected evictIfExpired(key: Key, entry: ExpirableCacheEntry<Key, Value>): EntryValidity {
		if (entry[EXPIRES_AT_SYM]! <= chrono.unixTime()) {
			this.deleteFromCache(key, entry); // metadata will be cleared by `onDelete` hook which is called by cache deleter
			return EntryValidity.NOT_VALID;
		}
		return EntryValidity.VALID;
	}

	protected static isNonExpirable(argumentsBundle: AbsoluteExpirationPolicyArgumentsBundle): boolean {
		return argumentsBundle.expiresAfter == null || argumentsBundle.expiresAfter === INFINITE_EXPIRATION;
	}
}

export { AbsoluteExpirationPolicy, AbsoluteExpirationPolicyArgumentsBundle };
