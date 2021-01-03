import { Milliseconds, Nullable, Seconds, Threshold } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { AbstractExpirationPolicy, ExpirableCacheKeyedEntry, EXPIRES_AT_SYM } from './abstract';
import { SetOperationContext } from '../../contracts/replacement-policy';

/**
 * Circular iterator over {@link CacheBackend} entries. <br/>
 * It should always return an entry by cycling over cache entries,
 * unless there are no more, in which case it should return `null`.
 */
type CacheEntriesCircularIterator<Key, Value> = () => ExpirableCacheKeyedEntry<Key, Value> | null;

/**
 * Query number of elements in the cache.
 */
type CacheSizeGetter = () => number;

interface MixedExpirationPolicyConfig<Key, Value> {
	/**
	 * Next cache entry getter.
	 */
	getNextCacheEntry: CacheEntriesCircularIterator<Key, Value>;

	/**
	 * Get number of elements in the cache.
	 */
	getCacheSize: CacheSizeGetter;

	/**
	 * Interval for running GC that checks for expired entries. <br/>
	 * Defaults to 30 seconds.
	 */
	checkInterval?: Seconds;
	/**
	 * How many entries GC needs to check for expiration. <br/>
	 * Defaults to 1000.
	 */
	iterateThreshold?: Threshold;
}

interface Config<Key, Value> extends MixedExpirationPolicyConfig<Key, Value> {
	checkInterval: Milliseconds;
	iterateThreshold: Threshold;
}

class MixedExpirationPolicy<Key, Value> extends AbstractExpirationPolicy<Key, Value> {
	private readonly config: Config<Key, Value>;

	private iterateTimeoutId: NodeJS.Timeout | null;

	constructor(config: MixedExpirationPolicyConfig<Key, Value>) {
		super();

		this.config = MixedExpirationPolicy.fillWithDefaults(config);
		this.iterateTimeoutId = null;
	}

	public onSet(key: Key, entry: ExpirableCacheKeyedEntry<Key, Value>, context: SetOperationContext): void {
		super.onSet(key, entry, context);
		entry.key = key;
		if (entry[EXPIRES_AT_SYM] && this.isIdle()) {
			// will be idle only if there are no more items in the cache
			this.scheduleNextCleanup();
		}
	}

	public onUpdate(key: Key, entry: ExpirableCacheKeyedEntry<Key, Value>, context: SetOperationContext): void {
		super.onUpdate(key, entry, context);
		entry.key = key;
		if (entry[EXPIRES_AT_SYM] && this.isIdle()) {
			this.scheduleNextCleanup();
		}
	}

	public onClear(): void {
		if (this.iterateTimeoutId !== null) {
			clearTimeout(this.iterateTimeoutId);
			this.iterateTimeoutId = null;
		}
	}

	public isIdle(): boolean {
		return this.iterateTimeoutId == null;
	}

	private cleanup = (): void => {
		const startingEntry = this.config.getNextCacheEntry();
		if (startingEntry == null) {
			// we need to check each time, because while we loop we might evict all entries before reaching iterate threshold
			this.iterateTimeoutId = null; // stop GC
			return;
		}

		let currentEntry: Nullable<ExpirableCacheKeyedEntry<Key, Value>> = startingEntry; // from now on there must be at least 1 entry
		let iteratedEntries = 0;

		do {
			super.evictIfExpired(currentEntry.key, currentEntry);

			// prefix incr to count entry processed above
			if (++iteratedEntries < this.config.iterateThreshold) {
				currentEntry = this.config.getNextCacheEntry()!;
				continue; // go for evaluation of next entry, but only if it differs from the starting one
			}

			break; // early exit from loop, because iterate threshold has been met

			// eslint-disable-next-line eqeqeq
		} while (currentEntry != startingEntry && this.config.getCacheSize()); // while we iterate we might evict all entries, so check for cache emptiness

		if (this.config.getCacheSize()) {
			// if we are there it means we have some unprocessed entries, so schedule next cleanup
			this.scheduleNextCleanup();
			return;
		}

		this.iterateTimeoutId = null; // stop GC
	};

	private scheduleNextCleanup(): void {
		this.iterateTimeoutId = setTimeout(this.cleanup, this.config.checkInterval);
	}

	private static fillWithDefaults<K, V>(config: MixedExpirationPolicyConfig<K, V>): Config<K, V> {
		config = { ...config };
		config.checkInterval = chrono.secondsToMilliseconds(config.checkInterval || 30);
		config.iterateThreshold = config.iterateThreshold || 1000;
		return config as Config<K, V>;
	}
}

export { MixedExpirationPolicy, CacheEntriesCircularIterator, MixedExpirationPolicyConfig };
