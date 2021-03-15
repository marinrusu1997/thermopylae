import { Threshold } from '@thermopylae/core.declarations';
import { INFINITE_KEYS } from '../../constants';
import { createException, ErrorCodes } from '../../error';
import { CacheReplacementPolicy, EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';
import { CacheEntry } from '../../contracts/commons';

// @fixme maybe this also needs to be removed, just no insert any policy into middle-end at all
class NoneEvictionPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	private readonly capacity: Threshold;

	constructor(capacity: Threshold) {
		if (capacity <= 0) {
			throw createException(ErrorCodes.INVALID_VALUE, `Capacity needs to be greater than 0. Given: ${capacity}.`);
		}

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
			throw createException(ErrorCodes.FULL, `Limit of ${this.capacity} has been reached and ${this.constructor.name} has been set. `);
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
	public setDeleter(): void {
		return undefined;
	}
}

export { NoneEvictionPolicy };
