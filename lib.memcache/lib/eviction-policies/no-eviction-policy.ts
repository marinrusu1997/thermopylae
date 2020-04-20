import { EvictionPolicy } from '../eviction-policy';

class NoEvictionPolicy<Key = string> implements EvictionPolicy<Key> {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	access(): void {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	evict(): void {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	setDeleter(): void {}
}

export { NoEvictionPolicy };
