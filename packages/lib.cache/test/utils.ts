// eslint-disable-next-line max-classes-per-file
import { Undefinable } from '@thermopylae/core.declarations';

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

	public get value(): Map<V, K[]> {
		return this.map;
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

class MapUtils {
	public static firstEntry<K, V>(map: Map<K, V>): Undefinable<[K, V]> {
		return map.entries().next().value;
	}

	public static firstKey<K, V>(map: Map<K, V>): Undefinable<K> {
		return map.keys().next().value;
	}

	public static lastEntry<K, V>(map: Map<K, V>): Undefinable<[K, V]> {
		return Array.from(map.entries()).pop();
	}

	public static lastKey<K, V>(map: Map<K, V>): Undefinable<K> {
		return Array.from(map.keys()).pop();
	}

	public static lastValue<K, V>(map: Map<K, V>): Undefinable<V> {
		return Array.from(map.values()).pop();
	}
}

export { ReverseMap, MapUtils };
