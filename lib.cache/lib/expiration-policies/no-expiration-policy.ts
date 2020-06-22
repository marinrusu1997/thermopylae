import { ExpirationPolicy } from '../contracts/expiration-policy';
import { CacheEntry } from '../contracts/cache';

class NoExpirationPolicy<Key, Value, Entry extends CacheEntry<Value>> implements ExpirationPolicy<Key, Value, Entry> {
	get requiresEntryOnDeletion(): boolean {
		return false;
	}

	onSet(): void {
		return undefined;
	}

	onUpdate(): void {
		return undefined;
	}

	removeIfExpired(): boolean {
		return false;
	}

	onDelete(): void {
		return undefined;
	}

	onClear() {
		return undefined;
	}

	setDeleter() {
		return undefined;
	}
}

export { NoExpirationPolicy };
