import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { EXPIRES_AT_SYM, INFINITE_TTL } from '../../constants';
import { EntryValidity } from '../../contracts/replacement-policy';
import { AbstractExpirationPolicy, ExpirableCacheEntry } from './abstract';

interface AbsoluteExpirationPolicyArgumentsBundle {
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
		if (options == null || AbsoluteExpirationPolicy.isNonExpirable(options)) {
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
		const expired = entry[EXPIRES_AT_SYM] != null ? entry[EXPIRES_AT_SYM]! <= chrono.unixTime() : false;
		if (expired) {
			this.deleteFromCache(key, entry); // metadata will be cleared by `onDelete` hook which is called by cache deleter
			return EntryValidity.NOT_VALID;
		}
		return EntryValidity.VALID;
	}

	protected static isNonExpirable(argumentsBundle: AbsoluteExpirationPolicyArgumentsBundle): boolean {
		return argumentsBundle.expiresAfter == null || argumentsBundle.expiresAfter === INFINITE_TTL;
	}
}

export { AbsoluteExpirationPolicy, AbsoluteExpirationPolicyArgumentsBundle };
