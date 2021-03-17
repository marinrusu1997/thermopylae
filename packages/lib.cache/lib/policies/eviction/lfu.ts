import { BaseLFUEvictionPolicy, EvictableKeyNode } from './lfu-base';

/**
 * [Least Frequently Used](https://en.wikipedia.org/wiki/Least_frequently_used "Least frequently used") eviction policy.
 */
class LFUEvictionPolicy<Key, Value, ArgumentsBundle> extends BaseLFUEvictionPolicy<Key, Value, ArgumentsBundle> {
	/**
	 * @inheritDoc
	 */
	protected get initialFrequency(): number {
		return 0;
	}

	/**
	 * @inheritDoc
	 */
	protected computeEntryFrequency(_entry: EvictableKeyNode<Key, Value>, entryScore: number): number {
		return entryScore + 1;
	}

	/**
	 * @inheritDoc
	 */
	protected onEvict(): void {
		return undefined; // eslint
	}
}

export { LFUEvictionPolicy };
