import { ExpirationPolicy } from '../../contracts/sync/expiration-policy';

class NoExpirationPolicy<Key, Value> implements ExpirationPolicy<Key, Value> {
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
