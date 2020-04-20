import { ExpirationPolicy } from '../contracts/expiration-policy';

class NoExpirationPolicy<Key = string> implements ExpirationPolicy<Key> {
	onSet() {
		return null;
	}

	onUpdate() {
		return null;
	}

	isExpired() {
		return false;
	}

	onClear() {
		return undefined;
	}

	setDeleter() {
		return undefined;
	}
}

export { NoExpirationPolicy };
