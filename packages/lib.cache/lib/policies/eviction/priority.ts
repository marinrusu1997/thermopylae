import { Minutes, Percentage } from '@thermopylae/core.declarations';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey, CacheSizeGetter } from '../../contracts/commons';

const PRIORITY_SYM = Symbol('PRIORITY_SYM');

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

interface PrioritizedCacheEntry<Key, Value> extends CacheKey<Key>, CacheEntry<Value> {
	[PRIORITY_SYM]: CacheEntryPriority;
}

interface PriorityEvictionPolicyArgumentsBundle {
	priority?: CacheEntryPriority;
}

/**
 * Iterator over {@link CacheBackend} entries.
 */
type CacheEntriesIterator<Key, Value> = () => PrioritizedCacheEntry<Key, Value> | null;

interface PriorityEvictionPolicyOptions<Key, Value> {
	/**
	 * Next cache entry getter.
	 */
	getNextCacheEntry: CacheEntriesIterator<Key, Value>;

	/**
	 * Get number of elements in the cache.
	 */
	getCacheSize: CacheSizeGetter;

	/**
	 * Interval for checking whether process is low on memory.<br/>
	 * Defaults to 60 minutes.
	 */
	checkInterval?: Minutes;

	/**
	 * Percentage of the available memory which is considered to be critical. <br/>
	 * When process reaches it or goes bellow, cache entries eviction kicks in on next {@link PriorityEvictionPolicyOptions.checkInterval}. <br/>
	 * Defaults to 20%.
	 */
	criticalAvailableMemoryPercentage?: Percentage;

	/**
	 * Percentage of cache entries that needs to be evicted when {@link PriorityEvictionPolicyOptions.criticalAvailableMemoryPercentage} is reached. <br/>
	 * Defaults to 20%.
	 */
	cacheEvictionPercentage?: Percentage;
}

/**
 * {@link CacheReplacementPolicy} which evicts entries when NodeJS process is low on memory. <br/>
 * Eviction is based on {@link CacheEntryPriority} and is performed in a **stop the world** way,
 * as it will iterate over cache entries to determine which ones needs to ne evicted.
 */
class PriorityEvictionPolicy<Key, Value, ArgumentsBundle extends PriorityEvictionPolicyArgumentsBundle>
	implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * @private
	 */
	private readonly options: Required<Readonly<PriorityEvictionPolicyOptions<Key, Value>>>;

	private readonly numberOfCacheEntriesByPriority: Map<CacheEntryPriority, number>;

	private deleteFromCache!: Deleter<Key, Value>;

	public constructor(options: PriorityEvictionPolicyOptions<Key, Value>) {
		this.options = PriorityEvictionPolicy.fillConstructorOptionsWithDefaults(options);
		this.numberOfCacheEntriesByPriority = new Map<CacheEntryPriority, number>();
		PriorityEvictionPolicy.fillNumberOfCacheEntriesByPriorityWithStartingValues(this.numberOfCacheEntriesByPriority);
	}

	public onGet(_key: Key, _entry: CacheEntry<Value>): EntryValidity {
		return EntryValidity.NOT_VALID;
	}

	public onSet(key: Key, entry: PrioritizedCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		entry.key = key; // @fixme maybe needs to be set by middle-end???
		entry[PRIORITY_SYM] = options && options.priority != null ? options.priority : CacheEntryPriority.NORMAL;

		this.increaseNumberOfEntries(entry[PRIORITY_SYM]);

		// @fixme start timer
	}

	public onUpdate(_key: Key, entry: PrioritizedCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		if (options == null || options.priority == null) {
			return;
		}

		if (entry[PRIORITY_SYM] === options.priority) {
			return;
		}

		this.decreaseNumberOfEntries(entry[PRIORITY_SYM]);
		entry[PRIORITY_SYM] = options.priority;
		this.increaseNumberOfEntries(entry[PRIORITY_SYM]);

		// @fixme no need to touch timer
	}

	public onDelete(_key: Key, _entry?: CacheEntry<Value>): void {
		return undefined;
	}

	public onClear(): void {
		PriorityEvictionPolicy.fillNumberOfCacheEntriesByPriorityWithStartingValues(this.numberOfCacheEntriesByPriority);
		// @fixme stop timer
	}

	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private increaseNumberOfEntries(priority: CacheEntryPriority): void {
		const actualNumber = this.numberOfCacheEntriesByPriority.get(priority)!;
		this.numberOfCacheEntriesByPriority.set(priority, actualNumber + 1);
	}

	private decreaseNumberOfEntries(priority: CacheEntryPriority): void {
		const actualNumber = this.numberOfCacheEntriesByPriority.get(priority)!;
		this.numberOfCacheEntriesByPriority.set(priority, actualNumber - 1);
	}

	private static fillConstructorOptionsWithDefaults<K, V>(
		options: PriorityEvictionPolicyOptions<K, V>
	): Required<Readonly<PriorityEvictionPolicyOptions<K, V>>> {
		if (options.checkInterval == null) {
			options.checkInterval = 60;
		}
		if (options.criticalAvailableMemoryPercentage == null) {
			options.criticalAvailableMemoryPercentage = 20;
		}
		if (options.cacheEvictionPercentage == null) {
			options.cacheEvictionPercentage = 20;
		}
		return options as Required<Readonly<PriorityEvictionPolicyOptions<K, V>>>;
	}

	private static fillNumberOfCacheEntriesByPriorityWithStartingValues(map: Map<CacheEntryPriority, number>): void {
		map.set(CacheEntryPriority.LOW, 0);
		map.set(CacheEntryPriority.ABOVE_NORMAL, 0);
		map.set(CacheEntryPriority.NORMAL, 0);
		map.set(CacheEntryPriority.ABOVE_NORMAL, 0);
		map.set(CacheEntryPriority.HIGH, 0);
		map.set(CacheEntryPriority.NOT_REMOVABLE, 0);
	}
}

export { PriorityEvictionPolicy, CacheEntryPriority };
