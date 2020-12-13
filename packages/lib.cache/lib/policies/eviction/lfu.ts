import { BaseLFUEvictionPolicy, EvictableKeyNode } from './lfu-base';

/**
 * [Least Frequently Used](https://en.wikipedia.org/wiki/Least_frequently_used "Least frequently used") eviction policy.
 */
class LFUEvictionPolicy<Key, Value> extends BaseLFUEvictionPolicy<Key, Value> {
	/**
	 * @inheritDoc
	 */
	protected computeEntryFrequency(_entry: EvictableKeyNode<Key, Value>, entryScore: number): number {
		return entryScore + 1;
	}
}

export { LFUEvictionPolicy };
