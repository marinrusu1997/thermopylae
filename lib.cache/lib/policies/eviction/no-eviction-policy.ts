import { Threshold } from '@thermopylae/core.declarations';
import { INFINITE_KEYS } from '../../constants';
import { createException, ErrorCodes } from '../../error';
import { CachePolicy, EntryValidity, SetOperationContext } from '../../contracts/cache-policy';
import { CacheEntry } from '../../contracts/commons';

class NoEvictionPolicy<Key, Value> implements CachePolicy<Key, Value> {
	private readonly capacity: Threshold;

	constructor(capacity: Threshold) {
		this.capacity = capacity;
	}

	public onGet(): EntryValidity {
		return EntryValidity.VALID;
	}

	public onSet(_key: Key, _entry: CacheEntry<Value>, context: SetOperationContext): void {
		if (this.capacity !== INFINITE_KEYS && context.totalEntriesNo >= this.capacity) {
			throw createException(ErrorCodes.CACHE_FULL, `Limit of ${this.capacity} has been reached and ${this.constructor.name} has been set. `);
		}
	}

	public onUpdate(): void {
		return undefined;
	}

	public onDelete(): void {
		return undefined;
	}

	public onClear(): void {
		return undefined;
	}

	public get requiresEntryOnDeletion(): boolean {
		return false;
	}

	public setDeleter(): void {
		return undefined;
	}
}

export { NoEvictionPolicy };
