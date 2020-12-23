import { CacheReplacementPolicy, Deleter } from '../lib/contracts/cache-policy';

class ReverseMap<V, K> implements Iterable<[V, K[]]> {
	private readonly map: Map<V, K[]>;

	private readonly iter: { bucket: IteratorResult<V>; bucketsIter: IterableIterator<V>; bucketElementsCount: number };

	public constructor(map: Map<K, V>) {
		if (map.size === 0) {
			throw new Error('Empty map given.');
		}

		const tempMap = new Map<V, K[]>();
		for (const [key, val] of map) {
			let arr = tempMap.get(val);
			if (arr == null) {
				arr = [];
				tempMap.set(val, arr);
			}
			arr.push(key);
		}

		this.map = new Map<V, K[]>([...tempMap].sort((a, b) => ((a[0] as unknown) as number) - ((b[0] as unknown) as number)));

		const keys = this.map.keys();
		this.iter = { bucketsIter: keys, bucket: keys.next(), bucketElementsCount: 0 };
	}

	public get bucket(): K[] {
		if (this.iter.bucket.done) {
			throw new Error(`All buckets have been iterated.`);
		}

		let bucket = this.map.get(this.iter.bucket.value)!;
		if (this.iter.bucketElementsCount < bucket.length) {
			this.iter.bucketElementsCount += 1;
			return bucket;
		}

		this.iter.bucket = this.iter.bucketsIter.next();
		if (this.iter.bucket.done) {
			throw new Error(`All buckets have been iterated.`);
		}

		bucket = this.map.get(this.iter.bucket.value)!;
		this.iter.bucketElementsCount = 1;
		return bucket;
	}

	public [Symbol.iterator](): IterableIterator<[V, K[]]> {
		return this.map[Symbol.iterator]();
	}
}

function generateExpirationPolicyDeleter<K, V>(policy: CacheReplacementPolicy<K, V>, deleter: Deleter<K>): Deleter<K> {
	if (policy.requiresEntryOnDeletion) {
		throw new Error("Can't generate deleter for policy which needs entry for delete hook");
	}

	return function remove(key: K): void {
		deleter(key);
		policy.onDelete(key);
	};
}

export { ReverseMap, generateExpirationPolicyDeleter };
