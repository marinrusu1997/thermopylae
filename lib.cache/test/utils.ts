import { Deleter } from '../lib/contracts/cache-policy';
import { ExpirationPolicy } from '../lib/contracts/expiration-policy';
import { CacheEntry } from '../lib/contracts/cache';

function generateExpirationPolicyDeleter<K, V>(policy: ExpirationPolicy<K, V, CacheEntry<V>>, deleter: Deleter<K>): Deleter<K> {
	if (policy.requiresEntryOnDeletion) {
		throw new Error("Can't generate deleter for policy which needs entry for delete hook");
	}

	return function remove(key: K): void {
		deleter(key);
		policy.onDelete(key);
	};
}

export { generateExpirationPolicyDeleter };