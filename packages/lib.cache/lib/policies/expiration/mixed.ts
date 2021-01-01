import { Milliseconds, Seconds, UnixTimestamp, Threshold } from '@thermopylae/core.declarations';
import { AbstractExpirationPolicy, ExpirableCacheEntry, EXPIRES_AT_SYM } from './abstract';
import { SetOperationContext } from '../../contracts/replacement-policy';
import { CacheEntry, CacheKey } from '../../contracts/commons';

type NextCacheKey<Key, Value> = () => ExpirableCacheKey<Key, Value> | null;

type QueryCollectionSize = () => number;

interface IterativeExpirationPolicyConfig<Key, Value> {
	nextCacheKey: NextCacheKey<Key, Value>;
	collectionSize: QueryCollectionSize;
	checkInterval?: Seconds;
	iterateThreshold?: Threshold;
}

interface Config<Key, Value> extends IterativeExpirationPolicyConfig<Key, Value> {
	checkInterval: Milliseconds;
	iterateThreshold: Threshold;
}

interface ExpirableCacheKey<Key, Value> extends CacheKey<Key>, CacheEntry<Value> {
	[EXPIRES_AT_SYM]?: UnixTimestamp; // @fixme replace by sym the fuck
}

class IterativeExpirationPolicy<Key, Value> extends AbstractExpirationPolicy<Key, Value> {
	private readonly config: Config<Key, Value>;

	private iterateTimeoutId: NodeJS.Timeout | null; // @fixme should not work if there are no items etc.

	private readonly getNextCacheKey: NextCacheKey<Key, Value>;

	private readonly getCollectionSize: QueryCollectionSize;

	constructor(config: IterativeExpirationPolicyConfig<Key, Value>) {
		super();

		this.config = IterativeExpirationPolicy.fillWithDefaults(config);
		this.iterateTimeoutId = null;
		this.getNextCacheKey = this.config.nextCacheKey;
		this.getCollectionSize = this.config.collectionSize;

		// @ts-ignore
		delete this.config.nextCacheKey;
		// @ts-ignore
		delete this.config.collectionSize;
	}

	public onSet(key: Key, entry: ExpirableCacheEntry<Value>, context: SetOperationContext): void {
		super.onSet(key, entry, context);
		if (entry[EXPIRES_AT_SYM] && this.isIdle()) {
			this.start();
		}
	}

	public onUpdate(key: Key, entry: ExpirableCacheEntry<Value>, context: SetOperationContext): void {
		super.onUpdate(key, entry, context);
		if (entry[EXPIRES_AT_SYM] && this.isIdle()) {
			this.start();
		}
	}

	public onClear(): void {
		if (this.iterateTimeoutId !== null) {
			clearTimeout(this.iterateTimeoutId);
			this.iterateTimeoutId = null;
		}
	}

	private cleanup = (): void => {
		const [currentIteration, currentCacheKey] = this.iterate(0);

		// check if we reached end and need to start from beginning
		if (currentIteration < this.config.iterateThreshold && currentCacheKey == null && currentIteration < this.getCollectionSize()) {
			this.iterate(currentIteration);
		}

		if (this.getCollectionSize() === 0) {
			this.iterateTimeoutId = null;
			return;
		}

		this.iterateTimeoutId = setTimeout(this.cleanup, this.config.checkInterval);
	};

	private isIdle(): boolean {
		return this.iterateTimeoutId == null;
	}

	private start(): void {
		this.iterateTimeoutId = setTimeout(this.cleanup, this.config.checkInterval);
	}

	private iterate(currentIteration: number): [number, ExpirableCacheKey<Key, Value> | null] {
		let cacheKey = this.getNextCacheKey(); // @fixme get next cache entry
		for (; currentIteration < this.config.iterateThreshold && cacheKey != null; currentIteration += 1, cacheKey = this.getNextCacheKey()) {
			super.evictIfExpired(cacheKey.key, cacheKey); // @fixme maybe we need to call super.onHit, and remove this protected fn ?
		}
		return [currentIteration, cacheKey];
	}

	private static fillWithDefaults<K, V>(config: IterativeExpirationPolicyConfig<K, V>): Config<K, V> {
		config.checkInterval = (config.checkInterval || 30) * 1000;
		config.iterateThreshold = config.iterateThreshold || 1000;
		return config as Config<K, V>;
	}
}

export { IterativeExpirationPolicy, ExpirableCacheKey, NextCacheKey, QueryCollectionSize, IterativeExpirationPolicyConfig };
