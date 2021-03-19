import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/replacement-policy';
import { CacheEntry } from '../../contracts/commons';

/**
 * Describes {@link CacheEntry} priority against eviction caused by lack of system memory.
 */
const enum CacheEntryPriority {
	/**
	 * Cache items with this priority level are the most likely to be deleted from the cache.
	 */
	LOW,
	/**
	 * Cache items with this priority level are more likely to be deleted from the cache than {@link CacheEntryPriority.NORMAL} priority.
	 */
	BELOW_NORMAL,
	/**
	 * Cache items with this priority level are likely to be deleted from the cache
	 * after those items with {@link CacheEntryPriority.LOW} or {@link CacheEntryPriority.BELOW_NORMAL} priority. <br/>
	 * This is the default.
	 */
	NORMAL,
	/**
	 * Cache items with this priority level are less likely to be deleted from cache
	 * than those assigned with {@link CacheEntryPriority.NORMAL} priority.
	 */
	ABOVE_NORMAL,
	/**
	 * Cache items with this priority level are the least likely to be deleted from the cache.
	 */
	HIGH,
	/**
	 * The cache items with this priority level will not be automatically deleted from the cache.
	 */
	NOT_REMOVABLE
}

class PriorityEvictionPolicy<Key, Value, ArgumentsBundle> implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	public onGet(_key: Key, _entry: CacheEntry<Value>): EntryValidity {
		return EntryValidity.NOT_VALID;
	}

	public onSet(_key: Key, _entry: CacheEntry<Value>, _options?: ArgumentsBundle): void {
		return undefined;
	}

	public onUpdate(_key: Key, _entry: CacheEntry<Value>, _options?: ArgumentsBundle): void {
		return undefined;
	}

	public onDelete(_key: Key, _entry?: CacheEntry<Value>): void {
		return undefined;
	}

	public onClear(): void {
		return undefined;
	}

	public setDeleter(_deleter: Deleter<Key, Value>): void {
		return undefined;
	}
}

export { PriorityEvictionPolicy, CacheEntryPriority };
