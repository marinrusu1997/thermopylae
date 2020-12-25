import { CacheReplacementPolicy, Deleter, EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';
import { CacheEntry } from '../../contracts/commons';

const enum CacheEntryPriority {
	// @fixme reorder them based on usage pattern
	LOW,
	MEDIUM,
	HIGH
}

class PriorityEvictionPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	public readonly requiresEntryOnDeletion: boolean;

	public constructor() {
		this.requiresEntryOnDeletion = false;
	}

	public onHit(key: Key, entry: CacheEntry<Value>): EntryValidity {
		return undefined;
	}

	public onMiss(key: Key): void {}

	public onSet(key: Key, entry: CacheEntry<Value>, context: SetOperationContext): void {}

	public onUpdate(key: Key, entry: CacheEntry<Value>, context: SetOperationContext): void {}

	public onDelete(key: Key, entry?: CacheEntry<Value>): void {}

	public onClear(): void {}

	public setDeleter(deleter: Deleter<Key>): void {}
}

export { PriorityEvictionPolicy, CacheEntryPriority };
