import { Nullable, Seconds, Threshold, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { EntryExpiredCallback, ExpirableEntry, GarbageCollector } from './interface';
import { EXPIRES_AT_SYM } from '../../constants';
import { IterableCacheBackend } from '../../contracts/cache-backend';
import { CacheEntry } from '../../contracts/commons';

/**
 * Circular iterator over {@link CacheBackend} entries. <br/>
 * It should always return an entry by cycling over cache entries,
 * unless there are no more, in which case it should return `null`.
 */
type CacheEntriesCircularIterator<T> = () => T | null;

interface IntervalGarbageCollectorOptions<Key, Value> {
	iterableBackend: IterableCacheBackend<Key, Value>;

	/**
	 * Interval for running GC that checks for expired entries. <br/>
	 * Defaults to 15 seconds.
	 */
	checkInterval?: Seconds;

	/**
	 * How many entries GC needs to check for expiration. <br/>
	 * Defaults to 100.
	 */
	iterateThreshold?: Threshold;
}

class IntervalGarbageCollector<Key, Value, T extends ExpirableEntry> implements GarbageCollector<T> {
	private readonly options: Required<IntervalGarbageCollectorOptions<Key, Value>>;

	private readonly getNextCacheEntry: CacheEntriesCircularIterator<T>;

	private iterateTimeoutId: NodeJS.Timeout | null;

	private entryExpiredCb!: EntryExpiredCallback<T>;

	public constructor(options: IntervalGarbageCollectorOptions<Key, Value>) {
		this.options = IntervalGarbageCollector.fillWithDefaults(options);
		this.getNextCacheEntry = IntervalGarbageCollector.createCacheEntriesCircularIterator(this.options.iterableBackend);
		this.iterateTimeoutId = null;
	}

	public get idle(): boolean {
		return this.iterateTimeoutId == null;
	}

	public get size(): number {
		return this.options.iterableBackend.size;
	}

	public manage(_entry: T): void {
		if (this.idle) {
			this.iterateTimeoutId = setTimeout(this.evictExpiredEntries, this.options.checkInterval);
		}
	}

	public update(_oldExpiration: UnixTimestamp, _entry: T): void {
		if (this.idle) {
			this.iterateTimeoutId = setTimeout(this.evictExpiredEntries, this.options.checkInterval);
		}
	}

	public leave(_entry: T): void {
		return undefined; // do nothing
	}

	public clear(): void {
		clearTimeout(this.iterateTimeoutId!);
		this.iterateTimeoutId = null;
	}

	public setEntryExpiredCallback(cb: EntryExpiredCallback<T>): void {
		this.entryExpiredCb = cb;
	}

	private evictExpiredEntries = (): void => {
		const startingEntry = this.getNextCacheEntry();
		if (startingEntry == null) {
			// we need to check each time, because while we loop we might evict all entries before reaching iterate threshold,
			// or all entries were evicted/explicitly deleted
			this.iterateTimeoutId = null; // stop GC
			return;
		}

		let currentEntry: Nullable<T> = startingEntry; // from now on there must be at least 1 entry
		let iteratedEntries = 0;

		do {
			if (currentEntry![EXPIRES_AT_SYM] <= chrono.unixTime()) {
				this.entryExpiredCb(currentEntry!);
			}

			// prefix incr to count entry processed above
			if (++iteratedEntries < this.options.iterateThreshold) {
				currentEntry = this.getNextCacheEntry()!;
				continue; // go for evaluation of next entry, but only if it differs from the starting one
			}

			break; // early exit from loop, because iterate threshold has been met

			// eslint-disable-next-line eqeqeq
		} while (currentEntry != startingEntry && this.options.iterableBackend.size); // while we iterate we might evict all entries, so check for cache emptiness

		if (this.options.iterableBackend.size) {
			// if we are there it means we have some unprocessed entries, so schedule next cleanup
			this.iterateTimeoutId = setTimeout(this.evictExpiredEntries, this.options.checkInterval);
			return;
		}

		this.iterateTimeoutId = null; // stop GC
	};

	private static fillWithDefaults<K, V>(options: IntervalGarbageCollectorOptions<K, V>): Required<IntervalGarbageCollectorOptions<K, V>> {
		options = { ...options };
		options.checkInterval = chrono.secondsToMilliseconds(options.checkInterval || 15);
		options.iterateThreshold = options.iterateThreshold || 100;
		return options as Required<IntervalGarbageCollectorOptions<K, V>>;
	}

	private static createCacheEntriesCircularIterator<K, V, Entry>(backend: IterableCacheBackend<K, V>): CacheEntriesCircularIterator<Entry> {
		let iterator: IterableIterator<CacheEntry<V>> = backend.values();

		return function nextCacheEntry(): Entry | null {
			let iterResult = iterator.next();

			if (iterResult.done) {
				iterator = backend.values(); // reset iter to beginning
				iterResult = iterator.next();

				if (iterResult.done) {
					return null; // there are no more entries
				}
			}

			return (iterResult.value as unknown) as Entry;
		};
	}
}

export { IntervalGarbageCollector, IntervalGarbageCollectorOptions };
