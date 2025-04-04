import { BaseLFUEvictionPolicy, type EvictableCacheEntry } from './lfu-base.js';

/**
 * [Least Frequently Used](https://en.wikipedia.org/wiki/Least_frequently_used) eviction policy.
 *
 * @template Key Type of the key.
 * @template Value Type of the value.
 * @template ArgumentsBundle Type of the arguments bundle.
 */
class LFUEvictionPolicy<Key, Value, ArgumentsBundle> extends BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> {
	/** @inheritDoc */
	protected get initialFrequency(): number {
		return 0;
	}

	/** @inheritDoc */
	protected computeEntryFrequency(_entry: EvictableCacheEntry<Key, Value>, entryScore: number): number {
		return entryScore + 1;
	}

	/** @inheritDoc */
	protected onEvict(): void {
		return undefined; // eslint
	}
}

export { LFUEvictionPolicy };
