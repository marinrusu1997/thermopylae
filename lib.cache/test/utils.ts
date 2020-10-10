import { Deleter, CachePolicy } from '../lib/contracts/cache-policy';

function generateExpirationPolicyDeleter<K, V>(policy: CachePolicy<K, V>, deleter: Deleter<K>): Deleter<K> {
	if (policy.requiresEntryOnDeletion) {
		throw new Error("Can't generate deleter for policy which needs entry for delete hook");
	}

	return function remove(key: K): void {
		deleter(key);
		policy.onDelete(key);
	};
}

export { generateExpirationPolicyDeleter };
