import { EvictionPolicy } from '../eviction-policy';
import { BaseCacheEntry } from '../caches/base-cache';

class NoEvictionPolicy<Key = string, Value = any, Entry extends BaseCacheEntry<Value> = BaseCacheEntry<Value>> implements EvictionPolicy<Key> {
	public wrapEntry(_key: Key, entry: Entry): Entry {
		return entry;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	accessed(): void {}

	evict(): boolean {
		return true; // eviction is not needed, therefore we will just say to clients that we freed up space
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	setDeleter(): void {}
}

export { NoEvictionPolicy };
