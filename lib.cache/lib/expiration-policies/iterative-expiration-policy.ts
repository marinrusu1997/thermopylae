import { Milliseconds, Seconds, UnixTimestamp, Threshold } from '@thermopylae/core.declarations';
import { AbstractExpirationPolicy } from './abstract-expiration-policy';
import { ExpirableCacheEntry } from '../contracts/expiration-policy';
import { CacheKey } from '../contracts/cache';

type NextCacheKey<Key> = () => ExpirableCacheKey<Key> | null;

type QueryCollectionSize = () => number;

interface IterativeExpirationPolicyConfig<Key> {
	nextCacheKey: NextCacheKey<Key>;
	collectionSize: QueryCollectionSize;
	checkInterval?: Seconds;
	iterateThreshold?: Threshold;
}

interface Config<Key> extends IterativeExpirationPolicyConfig<Key> {
	checkInterval: Milliseconds;
	iterateThreshold: Threshold;
}

interface ExpirableCacheKey<Key> extends CacheKey<Key> {
	expiresAt?: UnixTimestamp;
}

class IterativeExpirationPolicy<Key, Value, Entry extends ExpirableCacheEntry<Value> = ExpirableCacheEntry<Value>> extends AbstractExpirationPolicy<
	Key,
	Value,
	Entry
> {
	private readonly config: Config<Key>;

	private iterateTimeoutId: NodeJS.Timeout | null;

	private readonly getNextCacheKey: NextCacheKey<Key>;

	private readonly getCollectionSize: QueryCollectionSize;

	constructor(config: IterativeExpirationPolicyConfig<Key>) {
		super();

		this.config = IterativeExpirationPolicy.fillWithDefaults(config);
		this.iterateTimeoutId = null;
		this.getNextCacheKey = this.config.nextCacheKey;
		this.getCollectionSize = this.config.collectionSize;

		delete this.config.nextCacheKey;
		delete this.config.collectionSize;
	}

	public onSet(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		super.onSet(key, entry, expiresAfter, expiresFrom);
		if (entry.expiresAt && this.isIdle()) {
			this.start();
		}
	}

	public onUpdate(key: Key, entry: Entry, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): void {
		super.onUpdate(key, entry, expiresAfter, expiresFrom);
		if (entry.expiresAt && this.isIdle()) {
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

	private iterate(currentIteration: number): [number, ExpirableCacheKey<Key> | null] {
		let cacheKey = this.getNextCacheKey();
		for (; currentIteration < this.config.iterateThreshold && cacheKey != null; currentIteration += 1, cacheKey = this.getNextCacheKey()) {
			super.doRemovalIfExpired(cacheKey.key, cacheKey.expiresAt);
		}
		return [currentIteration, cacheKey];
	}

	private static fillWithDefaults<Key>(config: IterativeExpirationPolicyConfig<Key>): Config<Key> {
		config.checkInterval = (config.checkInterval || 30) * 1000;
		config.iterateThreshold = config.iterateThreshold || 1000;
		return config as Config<Key>;
	}
}

export { IterativeExpirationPolicy, NextCacheKey, QueryCollectionSize, IterativeExpirationPolicyConfig };