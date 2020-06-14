import { Threshold } from '@thermopylae/core.declarations';
import { EvictionPolicy } from '../contracts/eviction-policy';
import { CacheEntry } from '../contracts/cache';
import { INFINITE_KEYS } from '../constants';
import { createException, ErrorCodes } from '../error';

class NoEvictionPolicy<Key, Value, Entry extends CacheEntry<Value> = CacheEntry<Value>> implements EvictionPolicy<Key, Value, Entry> {
	private readonly capacity: Threshold;

	constructor(capacity: Threshold) {
		this.capacity = capacity;
	}

	public onSet(_key: Key, _entry: Entry, size: number): void {
		if (this.capacity !== INFINITE_KEYS && size >= this.capacity) {
			throw createException(ErrorCodes.CACHE_FULL, `Limit of ${this.capacity} has been reached and ${this.constructor.name} has been set. `);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public onGet(): void {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public onDelete(): void {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public onClear(): void {}

	public get requiresEntryOnDeletion(): boolean {
		return false;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public setDeleter(): void {}
}

export { NoEvictionPolicy };
