import { Threshold } from '@thermopylae/core.declarations';
import { EvictionPolicy } from '../contracts/eviction-policy';
import { ExpirableCacheValue } from '../contracts/cache';
import { INFINITE_KEYS } from '../constants';
import { createException, ErrorCodes } from '../error';

class NoEvictionPolicy<Key = string, Value = any, Entry extends ExpirableCacheValue<Value> = ExpirableCacheValue<Value>>
	implements EvictionPolicy<Key, Value, Entry> {
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
	public onGet(): void {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public onDelete(): void {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public onClear(): void {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public setDeleter(): void {}
}

export { NoEvictionPolicy };
