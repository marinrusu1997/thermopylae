/**
 * Data Structure which represents a list of buckets.
 *
 * @private
 */
interface BucketList<BucketKey, BucketEntry> {
	/**
	 * Number of managed buckets.
	 */
	numberOfBuckets: number;

	/**
	 * Total number of entries from all buckets.
	 */
	size: number;

	/**
	 * Add *entry* to bucket.
	 *
	 * @param toBucketId    Id of the bucket where *entry* needs to be inserted.
	 * @param entry         Entry to be added.
	 */
	add(toBucketId: BucketKey, entry: BucketEntry): void;

	/**
	 * Check if bucket contains *entry*.
	 *
	 * @param inTheBucketId     Bucked containing entry.
	 * @param entry             Searched entry.
	 */
	has(inTheBucketId: BucketKey, entry: BucketEntry): boolean;

	/**
	 * Move *entry* from one bucket into another.
	 *
	 * @param fromBucketId      Bucket where *entry* currently resides.
	 * @param toBucketId        Bucket where *entry* needs to be inserted.
	 * @param entry             Entry to be moved.
	 */
	move(fromBucketId: BucketKey, toBucketId: BucketKey, entry: BucketEntry): void;

	/**
	 * Remove *entry* from bucket.
	 *
	 * @param fromBucketId      Bucket where *entry* currently resides.
	 * @param entry             Entry to be removed.
	 */
	remove(fromBucketId: BucketKey, entry: BucketEntry): void;

	/**
	 * Clear all of the buckets.
	 */
	clear(): void;
}

export { BucketList };
