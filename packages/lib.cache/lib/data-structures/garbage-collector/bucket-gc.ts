import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { EntryExpiredCallback, ExpirableEntry, GarbageCollector } from './interface';
import { HashMapBucketList } from '../bucket-list/hash-map-bucket-list';
import { EXPIRES_AT_SYM } from '../../constants';
import { EvictionTimer } from './eviction-timer';

// reference: https://groups.google.com/g/memcached/c/MdNPv0oxhO8

class BucketGarbageCollector<T extends ExpirableEntry> implements GarbageCollector<T> {
	private static readonly EVICTION_TIMEOUT: Seconds = 1;

	private readonly buckets: HashMapBucketList<UnixTimestamp, T>;

	private readonly evictionTimer: EvictionTimer;

	private entryExpiredCb: EntryExpiredCallback<T>;

	public constructor(entryExpiredCb?: EntryExpiredCallback<T>) {
		this.buckets = new HashMapBucketList<UnixTimestamp, T>();
		this.evictionTimer = new EvictionTimer(this.evictionTimerHandler);
		this.entryExpiredCb = entryExpiredCb || BucketGarbageCollector.defaultEntryExpiredCallback;
	}

	public get idle(): boolean {
		return this.evictionTimer.idle;
	}

	public get size(): number {
		return this.buckets.size;
	}

	public manage(entry: T): void {
		this.buckets.add(entry[EXPIRES_AT_SYM], entry);
		this.evictionTimer.restart(entry[EXPIRES_AT_SYM]);
	}

	public update(oldExpiration: UnixTimestamp, entry: T): void {
		this.buckets.move(oldExpiration, entry[EXPIRES_AT_SYM], entry);
		this.evictionTimer.synchronize(entry[EXPIRES_AT_SYM]);
	}

	public leave(entry: T): void {
		this.buckets.remove(entry[EXPIRES_AT_SYM], entry);
		if (this.buckets.numberOfBuckets === 0) {
			this.evictionTimer.stop();
		}
	}

	public clear(): void {
		this.buckets.clear();
		this.evictionTimer.stop();
	}

	public setEntryExpiredCallback(cb: EntryExpiredCallback<T>): void {
		this.entryExpiredCb = cb;
	}

	private evictionTimerHandler = () => {
		// handle scenario when dropBucket took more than {@link BucketGarbageCollector.EVICTION_TIMEOUT}
		// in this case we need to also drop nearest bucket, to no skip him when we schedule timer for next second
		let now = chrono.unixTime();
		let evictedBucketId: UnixTimestamp;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			evictedBucketId = now;
			this.buckets.dropBucket(now, this.entryExpiredCb);
			now = chrono.unixTime();

			if (evictedBucketId === now) {
				break; // dropBucket took less than 1 sec
			}
		}

		if (this.buckets.numberOfBuckets === 0) {
			return this.evictionTimer.stop();
		}
		this.evictionTimer.startAfter(BucketGarbageCollector.EVICTION_TIMEOUT, now);
	};

	private static defaultEntryExpiredCallback(): void {
		return undefined;
	}
}

export { BucketGarbageCollector };
