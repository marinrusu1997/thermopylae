import { Threshold } from '@thermopylae/core.declarations';
import { EvictionPolicy } from '../../contracts/sync/eviction-policy';
import { INFINITE_KEYS } from '../../constants';
import { createException, ErrorCodes } from '../../error';
import { CacheEntry } from '../../contracts/sync/cache-backend';

class NoEvictionPolicy<Key, Value> implements EvictionPolicy<Key, Value> {
	private readonly capacity: Threshold;

	constructor(capacity: Threshold) {
		this.capacity = capacity;
	}

	public onSet(_key: Key, _entry: CacheEntry<Value>, size: number): void {
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
