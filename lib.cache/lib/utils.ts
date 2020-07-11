import { CacheBackend } from './contracts/sync/cache-backend';
import { NextCacheKey } from './policies/expiration';
import { ExpirableCacheKey } from './policies/expiration/iterative-expiration-policy';
import CacheEntry from './contracts/commons';

function generateCacheIterator<K, V>(backend: CacheBackend<K, V>): NextCacheKey<K> {
	let iterator: IterableIterator<[K, CacheEntry<V>]> = backend[Symbol.iterator]();

	return function nextCacheKey(): ExpirableCacheKey<K> | null {
		const entry = iterator.next();

		if (entry.done) {
			iterator = backend[Symbol.iterator](); // reposition to beginning
			return null;
		}

		// FIXME test for key availability
		// @ts-ignore
		return entry.value[1];
	};
}

export { generateCacheIterator };
