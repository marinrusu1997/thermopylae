import { IterableCacheBackend } from './contracts/cache-backend';
import { ExpirableCacheKeyedEntry } from './policies/expiration/abstract';
import { CacheEntriesCircularIterator } from './policies/expiration/mixed';
import { CacheEntry } from './contracts/commons';

function createCacheEntriesCircularIterator<Key, Value>(backend: IterableCacheBackend<Key, Value>): CacheEntriesCircularIterator<Key, Value> {
	let iterator: IterableIterator<CacheEntry<Value>> = backend.values();

	return function nextCacheKey(): ExpirableCacheKeyedEntry<Key, Value> | null {
		let entry = iterator.next();

		if (entry.done) {
			iterator = backend.values(); // reset iter to beginning
			entry = iterator.next();

			if (entry.done) {
				return null; // there are no more entries
			}
		}

		return entry.value as ExpirableCacheKeyedEntry<Key, Value>;
	};
}

export { createCacheEntriesCircularIterator };
