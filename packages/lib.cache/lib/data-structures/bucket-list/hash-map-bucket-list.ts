import type { Processor } from '@thermopylae/core.declarations';
import type { BucketList } from './interface.js';

/**
 * Data structures which keeps buckets identified by bucket key into EcmaScript 6 {@link Map}.
 *
 * @private
 */
class HashMapBucketList<BucketKey, BucketEntry> implements BucketList<BucketKey, BucketEntry> {
	private readonly buckets: Map<BucketKey, Set<BucketEntry>>;

	public constructor() {
		this.buckets = new Map<BucketKey, Set<BucketEntry>>();
	}

	public get numberOfBuckets(): number {
		return this.buckets.size;
	}

	public get size(): number {
		let items = 0;
		for (const bucket of this.buckets.values()) {
			items += bucket.size;
		}
		return items;
	}

	public add(bucketId: BucketKey, entry: BucketEntry): void {
		let bucket = this.buckets.get(bucketId);
		if (bucket == null) {
			bucket = new Set<BucketEntry>();
			this.buckets.set(bucketId, bucket);
		}
		bucket.add(entry);
	}

	public has(bucketId: BucketKey, entry: BucketEntry): boolean {
		const bucket = this.buckets.get(bucketId);
		if (bucket == null) {
			return false;
		}
		return bucket.has(entry);
	}

	public move(fromBucketId: BucketKey, toBucketId: BucketKey, entry: BucketEntry): void {
		this.remove(fromBucketId, entry);
		this.add(toBucketId, entry);
	}

	public remove(bucketId: BucketKey, entry: BucketEntry): void {
		const bucket = this.buckets.get(bucketId);
		if (bucket == null) {
			return;
		}
		bucket.delete(entry);

		if (bucket.size === 0) {
			this.buckets.delete(bucketId);
		}
	}

	public clear(): void {
		this.buckets.clear();
	}

	public dropBucket(bucketId: BucketKey, cb: Processor<BucketEntry>): void {
		const bucket = this.buckets.get(bucketId);
		if (bucket == null) {
			return;
		}
		bucket.forEach(cb);
		this.buckets.delete(bucketId);
	}
}

export { HashMapBucketList };
