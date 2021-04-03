import { Nullable, Percentage, Seconds } from '@thermopylae/core.declarations';
import { chrono, number } from '@thermopylae/lib.utils';
import { memoryUsage } from 'process';
import { CacheReplacementPolicy, Deleter, EntryValidity } from '../../contracts/cache-replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';
import { IterableCacheBackend } from '../../contracts/cache-backend';

// @fixme take into account gc: https://www.npmjs.com/package/gc-stats

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

interface PriorityEvictionPolicyOptions<Key, Value> {
	/**
	 * Iterable cache backend.
	 */
	iterableCacheBackend: IterableCacheBackend<Key, Value>;

	/**
	 * Interval for checking whether process is low on memory. <br/>
	 * Defaults to **3600 seconds**.
	 */
	checkInterval?: Seconds;

	/**
	 * Percentage of the available memory which is considered to be critical. <br/>
	 * When process reaches it or goes bellow, cache entries eviction kicks in on next {@link PriorityEvictionPolicyOptions.checkInterval}. <br/>
	 * Percentage is calculated by the following formula: **((heapTotal - heapUsed) * 100) / heapTotal**.
	 * > ⚠️ WARNING ⚠️ <br/>
	 * > Computation of the available memory doesn't take into account garbage collection and is subject to false positive results.
	 * GC is performed in a **stop the world** fashion, hence it's delayed by V8 as much as possible and performed when it's
	 * really needed, i.e. when process is low on memory. <br/>
	 * > Therefore, there is always a small chance that we will run our eviction handler and detect high memory usage
	 * before GC will occur.
	 *
	 * Defaults to **20%**.
	 */
	criticalAvailableMemoryPercentage?: Percentage;

	/**
	 * Percentage of cache entries that needs to be evicted when {@link PriorityEvictionPolicyOptions.criticalAvailableMemoryPercentage} is reached. <br/>
	 * Defaults to **20%**.
	 */
	cacheEvictionPercentage?: Percentage;
}

/**
 * {@link CacheReplacementPolicy} which evicts entries when NodeJS process is low on memory. <br/>
 * Eviction is based on {@link CacheEntryPriority} and is performed in a **stop the world** way,
 * as it will iterate over cache entries to determine which ones needs to ne evicted.
 */
class PriorityEvictionPolicy<Key, Value, ArgumentsBundle extends PriorityEvictionPolicyArgumentsBundle = PriorityEvictionPolicyArgumentsBundle>
	implements CacheReplacementPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * @private
	 */
	private readonly options: Required<Readonly<PriorityEvictionPolicyOptions<Key, Value>>>;

	private readonly numberOfCacheEntriesByPriority: Map<CacheEntryPriority, number>;

	private checkMemoryConsumptionIntervalId: Nullable<NodeJS.Timeout>;

	private deleteFromCache!: Deleter<Key, Value>;

	public constructor(options: PriorityEvictionPolicyOptions<Key, Value>) {
		this.options = PriorityEvictionPolicy.fillConstructorOptionsWithDefaults(options);
		this.numberOfCacheEntriesByPriority = new Map<CacheEntryPriority, number>();
		PriorityEvictionPolicy.fillNumberOfCacheEntriesByPriorityWithStartingValues(this.numberOfCacheEntriesByPriority);
		this.checkMemoryConsumptionIntervalId = null;
	}

	/**
	 * Whether eviction timer has been started.
	 */
	public get idle(): boolean {
		return this.checkMemoryConsumptionIntervalId == null;
	}

	/**
	 * @inheritDoc
	 */
	public onGet(): EntryValidity {
		return EntryValidity.VALID;
	}

	/**
	 * @inheritDoc
	 */
	public onSet(key: Key, entry: PrioritizedCacheEntry<Key, Value>, options?: ArgumentsBundle): void {
		entry.key = key;
		entry[PRIORITY_SYM] = options && options.priority != null ? options.priority : CacheEntryPriority.NORMAL;

		this.increaseNumberOfEntries(entry[PRIORITY_SYM]);

		if (this.checkMemoryConsumptionIntervalId == null) {
			const timeout = chrono.milliseconds(0, 0, this.options.checkInterval);
			this.checkMemoryConsumptionIntervalId = setInterval(this.performEvictionOnLowMemory, timeout);
		}
	}

	/**
	 * @inheritDoc
	 */
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
	}

	/**
	 * @inheritDoc
	 */
	public onDelete(_key: Key, entry: PrioritizedCacheEntry<Key, Value>): void {
		this.decreaseNumberOfEntries(entry[PRIORITY_SYM]);
		entry[PRIORITY_SYM] = undefined!; // logical deletion

		// depending on the order of calling 'onDelete' hook, cache might have 0 or 1 entry
		if (this.options.iterableCacheBackend.size < 2) {
			this.stopEvictionTimer();
		}
	}

	/**
	 * @inheritDoc
	 */
	public onClear(): void {
		PriorityEvictionPolicy.fillNumberOfCacheEntriesByPriorityWithStartingValues(this.numberOfCacheEntriesByPriority);
		if (this.checkMemoryConsumptionIntervalId) {
			this.stopEvictionTimer();
		}
	}

	/**
	 * @inheritDoc
	 */
	public setDeleter(deleter: Deleter<Key, Value>): void {
		this.deleteFromCache = deleter;
	}

	private performEvictionOnLowMemory = () => {
		const { heapTotal, heapUsed } = memoryUsage();
		const availableMemoryPercentage = (heapTotal - heapUsed) / heapTotal;

		if (availableMemoryPercentage <= this.options.criticalAvailableMemoryPercentage) {
			let totalNumberOfEntriesToBeEvicted = number.integerPercentage(this.options.iterableCacheBackend.size, this.options.cacheEvictionPercentage);
			const numberOfEntriesToEvictByPriority = this.computeNumberOfEntriesToEvictByPriority(totalNumberOfEntriesToBeEvicted);

			for (const entry of this.options.iterableCacheBackend.values() as IterableIterator<PrioritizedCacheEntry<Key, Value>>) {
				if (totalNumberOfEntriesToBeEvicted <= 0) {
					break;
				}
				if (numberOfEntriesToEvictByPriority[entry[PRIORITY_SYM]]) {
					this.deleteFromCache(entry.key, entry); // will trigger `onDelete` hook
					numberOfEntriesToEvictByPriority[entry[PRIORITY_SYM]] -= 1;
					totalNumberOfEntriesToBeEvicted -= 1;
				}
			}
		}

		if (this.options.iterableCacheBackend.size === 0) {
			this.stopEvictionTimer();
		}
	};

	private computeNumberOfEntriesToEvictByPriority(totalEntriesToBeEvicted: number): Record<CacheEntryPriority, number> {
		const toDelete: Record<CacheEntryPriority, number> = {
			[CacheEntryPriority.LOW]: 0,
			[CacheEntryPriority.BELOW_NORMAL]: 0,
			[CacheEntryPriority.NORMAL]: 0,
			[CacheEntryPriority.ABOVE_NORMAL]: 0,
			[CacheEntryPriority.HIGH]: 0,
			[CacheEntryPriority.NOT_REMOVABLE]: 0
		};

		// skip NOT_REMOVABLE ones by <
		for (let i = CacheEntryPriority.LOW; i < CacheEntryPriority.NOT_REMOVABLE; i++) {
			const numberOfEntriesByPriority = this.numberOfCacheEntriesByPriority.get(i)!;
			if (totalEntriesToBeEvicted <= numberOfEntriesByPriority) {
				toDelete[i] = totalEntriesToBeEvicted;
				break;
			}
			toDelete[i] = numberOfEntriesByPriority;
			totalEntriesToBeEvicted -= numberOfEntriesByPriority;
		}

		return toDelete;
	}

	private increaseNumberOfEntries(priority: CacheEntryPriority): void {
		const actualNumber = this.numberOfCacheEntriesByPriority.get(priority)!;
		this.numberOfCacheEntriesByPriority.set(priority, actualNumber + 1);
	}

	private decreaseNumberOfEntries(priority: CacheEntryPriority): void {
		const actualNumber = this.numberOfCacheEntriesByPriority.get(priority)!;
		this.numberOfCacheEntriesByPriority.set(priority, actualNumber - 1);
	}

	private stopEvictionTimer(): void {
		clearInterval(this.checkMemoryConsumptionIntervalId!); // we are guaranteed to have timer started
		this.checkMemoryConsumptionIntervalId = null; // mark as stopped
	}

	private static fillConstructorOptionsWithDefaults<K, V>(
		options: PriorityEvictionPolicyOptions<K, V>
	): Required<Readonly<PriorityEvictionPolicyOptions<K, V>>> {
		options.checkInterval = options.checkInterval || 3600;
		number.assertIsInteger(options.checkInterval);

		options.criticalAvailableMemoryPercentage = options.criticalAvailableMemoryPercentage || 0.2;
		number.assertIsPercentage(options.criticalAvailableMemoryPercentage);

		options.cacheEvictionPercentage = options.cacheEvictionPercentage || 0.2;
		number.assertIsPercentage(options.cacheEvictionPercentage);

		return options as Required<Readonly<PriorityEvictionPolicyOptions<K, V>>>;
	}

	private static fillNumberOfCacheEntriesByPriorityWithStartingValues(map: Map<CacheEntryPriority, number>): void {
		map.set(CacheEntryPriority.LOW, 0);
		map.set(CacheEntryPriority.BELOW_NORMAL, 0);
		map.set(CacheEntryPriority.NORMAL, 0);
		map.set(CacheEntryPriority.ABOVE_NORMAL, 0);
		map.set(CacheEntryPriority.HIGH, 0);
		map.set(CacheEntryPriority.NOT_REMOVABLE, 0);
	}
}

export { PriorityEvictionPolicy, PriorityEvictionPolicyOptions, CacheEntryPriority, PrioritizedCacheEntry, PRIORITY_SYM };
