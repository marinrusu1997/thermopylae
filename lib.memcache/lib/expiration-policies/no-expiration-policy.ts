import { ExpirationPolicy } from '../expiration-policy';

class NoExpirationPolicy<Key = string> implements ExpirationPolicy<Key> {
	expires() {
		return null;
	}

	updateExpires() {
		return null;
	}

	expired() {
		return false;
	}

	resetExpires() {
		return undefined;
	}

	setDeleter() {
		return undefined;
	}
}

export { NoExpirationPolicy };
