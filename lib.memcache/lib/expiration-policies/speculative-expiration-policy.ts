import { Milliseconds, Seconds, UnixTimestamp, Threshold } from '@thermopylae/core.declarations';
import { AbstractExpirationPolicy } from './abstract-expiration-policy';
import { ExpirableCacheKey } from '../contracts/cache';

type NextCacheKey<Key = string> = () => ExpirableCacheKey<Key> | null;

type QueryCollectionSize = () => number;

interface SpeculativeExpirationPolicyConfig<Key = string> {
	nextCacheKey: NextCacheKey<Key>;
	collectionSize: QueryCollectionSize;
	checkInterval?: Seconds;
	iterateThreshold?: Threshold;
}

interface Config<Key = string> extends SpeculativeExpirationPolicyConfig<Key> {
	checkInterval: Milliseconds;
	iterateThreshold: Threshold;
}

class SpeculativeExpirationPolicy<Key = string> extends AbstractExpirationPolicy<Key> {
	private readonly config: Config<Key>;

	private iterateTimeoutId: NodeJS.Timeout | null;

	private readonly getNextCacheKey: NextCacheKey<Key>;

	private readonly getCollectionSize: QueryCollectionSize;

	constructor(config: SpeculativeExpirationPolicyConfig<Key>) {
		super();

		this.config = SpeculativeExpirationPolicy.fillWithDefaults(config);
		this.iterateTimeoutId = null;
		this.getNextCacheKey = this.config.nextCacheKey;
		this.getCollectionSize = this.config.collectionSize;

		delete this.config.nextCacheKey;
		delete this.config.collectionSize;
	}

	public expiresAt(key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null {
		const expiresAt = super.expiresAt(key, expiresAfter, expiresFrom);
		this.startIfIdle(expiresAt);
		return expiresAt;
	}

	public updateExpiresAt(key: Key, expiresAfter: Seconds, expiresFrom?: UnixTimestamp): UnixTimestamp | null {
		const newExpiresAt = super.updateExpiresAt(key, expiresAfter, expiresFrom);
		this.startIfIdle(newExpiresAt);
		return newExpiresAt;
	}

	public onClear(): void {
		if (this.iterateTimeoutId !== null) {
			clearTimeout(this.iterateTimeoutId);
			this.iterateTimeoutId = null;
		}
	}

	public isExpired(): boolean {
		return false;
	}

	private cleanup = (): void => {
		let iterations = 0;
		let cacheKey = this.getNextCacheKey();
		// eslint-disable-next-line no-plusplus
		for (; iterations < this.config.iterateThreshold && cacheKey !== null; iterations++, cacheKey = this.getNextCacheKey()) {
			super.isExpired(cacheKey.key, cacheKey.expiresAt);
		}

		// check if we reached end and need to start from beginning
		if (iterations < this.config.iterateThreshold && cacheKey === null && iterations < this.getCollectionSize()) {
			// this code was duplicated for speed
			cacheKey = this.getNextCacheKey(); // reset iterator to begin
			// eslint-disable-next-line no-plusplus
			for (; iterations < this.config.iterateThreshold && cacheKey !== null; iterations++, cacheKey = this.getNextCacheKey()) {
				super.isExpired(cacheKey.key, cacheKey.expiresAt);
			}
		}

		if (this.getCollectionSize() === 0) {
			this.iterateTimeoutId = null;
			return;
		}

		this.iterateTimeoutId = setTimeout(this.cleanup, this.config.checkInterval);
	};

	private startIfIdle(expiresAt: UnixTimestamp | null): void {
		if (this.iterateTimeoutId === null && expiresAt !== null) {
			this.iterateTimeoutId = setTimeout(this.cleanup, this.config.checkInterval);
		}
	}

	private static fillWithDefaults<Key>(config: SpeculativeExpirationPolicyConfig<Key>): Config<Key> {
		config.checkInterval = (config.checkInterval || 30) * 1000;
		config.iterateThreshold = config.iterateThreshold || 1000;
		return config as Config<Key>;
	}
}

export { SpeculativeExpirationPolicy, NextCacheKey, QueryCollectionSize, SpeculativeExpirationPolicyConfig };
