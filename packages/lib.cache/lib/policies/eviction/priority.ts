import { CacheReplacementPolicy, Deleter, EntryValidity, SetOperationContext } from '../../contracts/replacement-policy';
import { CacheEntry } from '../../contracts/commons';

const enum CacheEntryPriority {
	// @fixme reorder them based on usage pattern
	LOW,
	MEDIUM,
	HIGH
}

class PriorityEvictionPolicy<Key, Value> implements CacheReplacementPolicy<Key, Value> {
	public onHit(_key: Key, _entry: CacheEntry<Value>): EntryValidity {
		return EntryValidity.NOT_VALID;
	}

	public onMiss(_key: Key): void {
		return undefined;
	}

	public onSet(_key: Key, _entry: CacheEntry<Value>, _context: SetOperationContext): void {
		return undefined;
	}

	public onUpdate(_key: Key, _entry: CacheEntry<Value>, _context: SetOperationContext): void {
		return undefined;
	}

	public onDelete(_key: Key, _entry?: CacheEntry<Value>): void {
		return undefined;
	}

	public onClear(): void {
		return undefined;
	}

	public setDeleter(_deleter: Deleter<Key>): void {
		return undefined;
	}
}

export { PriorityEvictionPolicy, CacheEntryPriority };
