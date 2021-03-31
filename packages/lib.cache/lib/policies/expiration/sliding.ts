import { Seconds } from '@thermopylae/core.declarations';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../constants';
import { GarbageCollector } from '../../data-structures/garbage-collector/interface';
import { BucketGarbageCollector } from '../../data-structures/garbage-collector/bucket-gc';
import { AbstractExpirationPolicy, ExpirableCacheEntry } from './abstract';
import { EntryValidity } from '../../contracts/replacement-policy';

const TIME_SPAN_SYM = Symbol('TIME_SPAN_SYM');

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

class SlidingProactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends SlidingExpirationPolicyArgsBundle = SlidingExpirationPolicyArgsBundle
> extends AbstractExpirationPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * @private
	 */
	private readonly gc: GarbageCollector<any>;

	public constructor(gc?: GarbageCollector<any>) {
		super();

		this.gc = gc || new BucketGarbageCollector<any>();
		this.gc.setEntryExpiredCallback((expiredEntry) => {
			// remove from cache, will trigger `onDelete` which will detach ttl metadata
			this.deleteFromCache(expiredEntry.key, expiredEntry);
		});
	}

	public get size(): number {
		return this.gc.size;
	}

	public get idle(): boolean {
		return this.gc.idle;
	}

	public onGet(_key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>): EntryValidity {
		// @fixme test case when item was untracked after onUpdate, and then accessed onGet
		if (entry[TIME_SPAN_SYM] == null) {
			return EntryValidity.VALID; // nothing to do
		}

		const oldExpiration = entry[EXPIRES_AT_SYM];
		SlidingProactiveExpirationPolicy.setEntryExpiration(entry, entry[TIME_SPAN_SYM]!);
		this.gc.update(oldExpiration!, entry);

		return EntryValidity.VALID;
	}

	public onSet(key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || SlidingProactiveExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		this.scheduleEviction(key, entry, options);
	}

	// @fixme test that on update it does nothing when time span is not specified
	public onUpdate(key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || options.timeSpan == null) {
			return undefined;
		}

		// @fixme test case when item is set, then update with no ttl, then set again !!!
		if (entry[TIME_SPAN_SYM]) {
			if (options.timeSpan === INFINITE_EXPIRATION) {
				return this.onDelete(key, entry); // we do not track it anymore
			}

			if (options.timeSpan === entry[TIME_SPAN_SYM]) {
				return; // do nothing on same timespan, let it be eviction when old time span expires
			}

			const oldExpiration = entry[EXPIRES_AT_SYM]!;
			SlidingProactiveExpirationPolicy.storeExpirationMetadata(entry, options);
			return this.gc.update(oldExpiration, entry);
		}

		if (options.timeSpan !== INFINITE_EXPIRATION) {
			this.scheduleEviction(key, entry, options); // previously had no time span, now it does
		}
	}

	public onDelete(key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>): void {
		// @fixme test that does not remove entry without expiration
		// @fixme detach metadata
		this.gc.leave(entry);
		super.onDelete(key, entry); // detach expiration metadata
		entry[TIME_SPAN_SYM] = undefined; // logical delete time span metadata
	}

	public onClear(): void {
		this.gc.clear();
	}

	private scheduleEviction(key: Key, entry: ExpirableSlidingCacheEntry<Key, Value>, options: ArgumentsBundle): void {
		entry.key = key;
		SlidingProactiveExpirationPolicy.storeExpirationMetadata(entry, options);
		this.gc.manage(entry);
	}

	private static storeExpirationMetadata<EntryKey, EntryValue, ArgsBundle extends SlidingExpirationPolicyArgsBundle>(
		entry: ExpirableSlidingCacheEntry<EntryKey, EntryValue>,
		options: ArgsBundle
	) {
		entry[TIME_SPAN_SYM] = options.timeSpan;
		SlidingProactiveExpirationPolicy.setEntryExpiration(entry, options.timeSpan!);
	}

	private static isNonExpirable(options: SlidingExpirationPolicyArgsBundle): boolean {
		return options.timeSpan == null || options.timeSpan === INFINITE_EXPIRATION;
	}
}

export { SlidingProactiveExpirationPolicy, ExpirableSlidingCacheEntry, TIME_SPAN_SYM };
