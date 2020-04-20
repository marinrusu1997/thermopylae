import { Threshold } from '@thermopylae/core.declarations';
import { EvictionPolicy } from '../eviction-policy';
import { BaseCacheEntry, INFINITE_KEYS } from '../cache';
import { createException, ErrorCodes } from '../error';

class NoEvictionPolicy<Key = string, Value = any, Entry extends BaseCacheEntry<Value> = BaseCacheEntry<Value>> implements EvictionPolicy<Key, Value, Entry> {
	private readonly capacity: Threshold;

	constructor(capacity: Threshold) {
		this.capacity = capacity;
	}

	public onSet(_key: Key, entry: Entry, size: number): Entry {
		if (this.capacity !== INFINITE_KEYS && size >= this.capacity) {
			throw createException(ErrorCodes.CACHE_FULL, `Limit of ${this.capacity} has been reached and ${this.constructor.name} has been set. `);
		}

		return entry;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	onGet(): void {}

	evict(): boolean {
		return true; // eviction is not needed, therefore we will just say to clients that we freed up space
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	setDeleter(): void {}
}

export { NoEvictionPolicy };
