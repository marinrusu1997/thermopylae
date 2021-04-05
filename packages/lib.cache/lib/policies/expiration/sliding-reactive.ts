import { Seconds } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy, ExpirableCacheEntry } from './abstract';
import { EntryValidity } from '../../contracts/cache-replacement-policy';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../constants';

/**
 * @internal
 */
const TIME_SPAN_SYM = Symbol('TIME_SPAN_SYM_REACTIVE');

/**
 * @internal
 */
interface ExpirableSlidingCacheEntry<Key, Value> extends ExpirableCacheEntry<Key, Value> {
	[TIME_SPAN_SYM]?: Seconds;
}

interface SlidingExpirationPolicyArgsBundle {
	/**
	 * Time span identifies how long the data should remain in the cache
	 * after the data was last accessed.
	 */
	timeSpan?: Seconds;
}

/**
 * Expiration policy which evicts keys based on time span access. <br/>
 * If key wasn't accessed in the specified {@link SlidingExpirationPolicyArgsBundle.timeSpan},
 * it will be evicted on the next {@link Cache.get} operation. <br/>
 * If key was accessed in that time span, it's expiration time will be increased with the value of time span.
 *
 * @template Key				Type of the key.
 * @template Value				Type of the value.
 * @template ArgumentsBundle	Type of the arguments bundle.
 */
class SlidingReactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends SlidingExpirationPolicyArgsBundle = SlidingExpirationPolicyArgsBundle
> extends AbstractExpirationPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * @inheritDoc
	 */
	public onHit(key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>): EntryValidity {
		if (entry[TIME_SPAN_SYM] == null) {
			return EntryValidity.VALID; // nothing to do
		}

		if (entry[EXPIRES_AT_SYM]! <= chrono.unixTime()) {
			this.deleteFromCache(key, entry); // metadata will be cleared by `onDelete` hook which is called by cache deleter
			return EntryValidity.NOT_VALID;
		}

		SlidingReactiveExpirationPolicy.setEntryExpiration(entry, entry[TIME_SPAN_SYM]!); // refresh expiration
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onSet(_key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || SlidingReactiveExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		SlidingReactiveExpirationPolicy.storeExpirationMetadata(entry, options);
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || options.timeSpan == null) {
			return undefined;
		}

		if (entry[TIME_SPAN_SYM]) {
			if (options.timeSpan === INFINITE_EXPIRATION) {
				return this.onDelete(key, entry); // @fixme we do not track it anymore
			}

			if (options.timeSpan === entry[TIME_SPAN_SYM]) {
				return undefined; // do nothing on same timespan, let it be evicted when old time span expires
			}

			SlidingReactiveExpirationPolicy.storeExpirationMetadata(entry, options); // update time span and expiration
			return undefined;
		}

		if (options.timeSpan !== INFINITE_EXPIRATION) {
			SlidingReactiveExpirationPolicy.storeExpirationMetadata(entry, options);
		}

		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>): void {
		super.onDelete(key, entry); // detach expiration metadata
		entry[TIME_SPAN_SYM] = undefined; // logical delete time span metadata
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		return undefined; // we have to do nothing
	}

	private static storeExpirationMetadata<EntryKey, EntryValue, ArgsBundle extends SlidingExpirationPolicyArgsBundle>(
		entry: ExpirableSlidingCacheEntry<EntryKey, EntryValue>,
		options: ArgsBundle
	) {
		entry[TIME_SPAN_SYM] = options.timeSpan;
		SlidingReactiveExpirationPolicy.setEntryExpiration(entry, options.timeSpan!);
	}

	private static isNonExpirable(options: SlidingExpirationPolicyArgsBundle): boolean {
		return options.timeSpan == null || options.timeSpan === INFINITE_EXPIRATION;
	}
}

export { SlidingReactiveExpirationPolicy, SlidingExpirationPolicyArgsBundle, ExpirableSlidingCacheEntry, TIME_SPAN_SYM };
