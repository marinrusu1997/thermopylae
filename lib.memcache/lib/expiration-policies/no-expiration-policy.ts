import { ExpirationPolicy } from '../contracts/expiration-policy';

class NoExpirationPolicy<Key = string> implements ExpirationPolicy<Key> {
	expiresAt() {
		return null;
	}

	updateExpiresAt() {
		return null;
	}

	isExpired() {
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
