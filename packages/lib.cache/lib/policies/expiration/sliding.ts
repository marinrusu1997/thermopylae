import type { Seconds } from '@thermopylae/core.declarations';
import { EXPIRES_AT_SYM, INFINITE_EXPIRATION } from '../../constants.js';
import { EntryValidity } from '../../contracts/cache-replacement-policy.js';
import { BucketGarbageCollector } from '../../garbage-collectors/bucket-gc.js';
import type { GarbageCollector } from '../../garbage-collectors/interface.js';
import { AbstractExpirationPolicy, type ExpirableCacheEntry } from './abstract.js';

/** @private */
const TIME_SPAN_SYM = Symbol('TIME_SPAN_SYM_PROACTIVE');

/** @private */
interface ExpirableSlidingCacheEntry<Key, Value> extends ExpirableCacheEntry<Key, Value> {
	[TIME_SPAN_SYM]?: Seconds;
}

interface SlidingExpirationPolicyArgsBundle {
	/**
	 * Time span identifies how long the data should remain in the cache after the data was last
	 * accessed.
	 */
	timeSpan?: Seconds;
}

/**
 * Expiration policy which evicts keys based on time span access. <br/> If key wasn't accessed in
 * the specified {@link SlidingExpirationPolicyArgsBundle.timeSpan}, it will be evicted by
 * {@link GarbageCollector} in the background. <br/> If key was accessed in that time span, it's
 * expiration time will be increased with the value of time span.
 *
 * @template Key Type of the key.
 * @template Value Type of the value.
 * @template ArgumentsBundle Type of the arguments bundle.
 */
class SlidingProactiveExpirationPolicy<
	Key,
	Value,
	ArgumentsBundle extends SlidingExpirationPolicyArgsBundle = SlidingExpirationPolicyArgsBundle
> extends AbstractExpirationPolicy<Key, Value, ArgumentsBundle> {
	/** @private */
	private readonly gc: GarbageCollector<any>;

	public constructor(gc?: GarbageCollector<any>) {
		super();

		this.gc = gc || new BucketGarbageCollector<any>();
		this.gc.setEntryExpiredCallback((expiredEntry) => {
			// remove from cache, will trigger `onDelete` which will detach ttl metadata
			this.deleteFromCache(expiredEntry);
		});
	}

	/** Get the number of tracked for expiration keys. */
	public get size(): number {
		return this.gc.size;
	}

	/** Check whether GC is idle. */
	public get idle(): boolean {
		return this.gc.idle;
	}

	/** @inheritDoc */
	public onHit(entry: ExpirableSlidingCacheEntry<Key, Value>): EntryValidity {
		if (entry[TIME_SPAN_SYM] == null) {
			return EntryValidity.VALID; // nothing to do
		}

		const oldExpiration = entry[EXPIRES_AT_SYM];
		SlidingProactiveExpirationPolicy.setEntryExpiration(entry, entry[TIME_SPAN_SYM]!);
		this.gc.update(oldExpiration!, entry);

		return EntryValidity.VALID;
	}

	/** @inheritDoc */
	public onSet(entry: ExpirableSlidingCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || SlidingProactiveExpirationPolicy.isNonExpirable(options)) {
			return;
		}

		this.scheduleEviction(entry, options);
	}

	/** @inheritDoc */
	public onUpdate(entry: ExpirableSlidingCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || options.timeSpan == null) {
			return undefined;
		}

		if (entry[TIME_SPAN_SYM]) {
			if (options.timeSpan === INFINITE_EXPIRATION) {
				return this.onDelete(entry); // we do not track it anymore
			}

			if (options.timeSpan === entry[TIME_SPAN_SYM]) {
				return; // do nothing on same timespan, let it be evicted when old time span expires
			}

			const oldExpiration = entry[EXPIRES_AT_SYM]!;
			SlidingProactiveExpirationPolicy.storeExpirationMetadata(entry, options);
			return this.gc.update(oldExpiration, entry);
		}

		if (options.timeSpan !== INFINITE_EXPIRATION) {
			this.scheduleEviction(entry, options); // previously had no time span, now it does
		}
	}

	/** @inheritDoc */
	public override onDelete(entry: ExpirableSlidingCacheEntry<Key, Value>): void {
		this.gc.leave(entry);
		super.onDelete(entry); // detach expiration metadata
		entry[TIME_SPAN_SYM] = undefined; // logical delete time span metadata
	}

	/** @inheritDoc */
	public onClear(): void {
		this.gc.clear();
	}

	private scheduleEviction(entry: ExpirableSlidingCacheEntry<Key, Value>, options: ArgumentsBundle): void {
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

export { SlidingProactiveExpirationPolicy, type ExpirableSlidingCacheEntry, type SlidingExpirationPolicyArgsBundle, TIME_SPAN_SYM };
