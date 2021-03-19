import { IterableCacheBackend } from './contracts/cache-backend';
import { CacheEntriesCircularIterator } from './policies/expiration/mixed';
import { CacheEntry } from './contracts/commons';
import { ExpirableCacheEntry } from './policies/expiration/abstract';

function createCacheEntriesCircularIterator<Key, Value>(backend: IterableCacheBackend<Key, Value>): CacheEntriesCircularIterator<Key, Value> {
	let iterator: IterableIterator<CacheEntry<Value>> = backend.values();

	return function nextCacheKey(): ExpirableCacheEntry<Key, Value> | null {
		let entry = iterator.next();

		if (entry.done) {
			iterator = backend.values(); // reset iter to beginning
			entry = iterator.next();

			if (entry.done) {
				return null; // there are no more entries
			}
		}

		return entry.value as ExpirableCacheEntry<Key, Value>;
	};
}

export { createCacheEntriesCircularIterator };
