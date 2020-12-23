import { Threshold } from '@thermopylae/core.declarations';
import { INFINITE_KEYS } from '../../constants';
import { createException, ErrorCodes } from '../../error';
import { CacheReplacementPolicy, EntryValidity, SetOperationContext } from '../../contracts/cache-policy';
import { CacheEntry } from '../../contracts/commons';

class NoneEvictionPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	private readonly capacity: Threshold;

	constructor(capacity: Threshold) {
		this.capacity = capacity;
	}

	/**
	 * @inheritDoc
	 */
	public onHit(): EntryValidity {
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onMiss(_key: Key): void {
		return undefined; // eslint
	}

	/**
	 * @inheritDoc
	 */
	public onSet(_key: Key, _entry: CacheEntry<Value>, context: SetOperationContext): void {
		if (this.capacity !== INFINITE_KEYS && context.totalEntriesNo >= this.capacity) {
			throw createException(ErrorCodes.CACHE_FULL, `Limit of ${this.capacity} has been reached and ${this.constructor.name} has been set. `);
		}
	}

	/**
	 * @inheritDoc
	 */
	public onUpdate(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		return undefined;
	}

	/**
	 * @inheritDoc
	 */
	public get requiresEntryOnDeletion(): boolean {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(): void {
		return undefined;
	}
}

export { NoneEvictionPolicy };
