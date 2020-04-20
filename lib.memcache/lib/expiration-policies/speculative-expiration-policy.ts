import { Milliseconds, Seconds, UnixTimestamp, Threshold } from '@thermopylae/core.declarations';
import { AbstractExpirationPolicy } from './abstract-expiration-policy';

interface ExpirableCacheEntry<Key = string> {
	key: Key;
	expires: UnixTimestamp | null;
}

type NextCacheEntry<Key = string> = () => ExpirableCacheEntry<Key> | null;

type QueryCollectionSize = () => number;

interface SpeculativeExpirationPolicyConfig<Key = string> {
	nextCacheEntry: NextCacheEntry<Key>;
	collectionSize: QueryCollectionSize;
	checkPeriod?: Seconds;
	iterateThreshold?: Threshold;
}

interface Config<Key = string> extends SpeculativeExpirationPolicyConfig<Key> {
	checkPeriod: Milliseconds;
	iterateThreshold: Threshold;
}

class SpeculativeExpirationPolicy<Key = string> extends AbstractExpirationPolicy<Key> {
	private readonly config: Config<Key>;

	private iterateTimeoutId: NodeJS.Timeout | null;

	private readonly nextCacheEntry: NextCacheEntry<Key>;

	private readonly collectionSize: QueryCollectionSize;

	constructor(config: SpeculativeExpirationPolicyConfig<Key>) {
		super();

		this.config = SpeculativeExpirationPolicy.fillWithDefaults(config);
		this.iterateTimeoutId = null;
		this.nextCacheEntry = this.config.nextCacheEntry;
		this.collectionSize = this.config.collectionSize;

		delete this.config.nextCacheEntry;
		delete this.config.collectionSize;
	}

	public expires(key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null {
		const expires = super.expires(key, after, from);
		this.startIfIdle(expires);
		return expires;
	}

	public updateExpires(key: Key, after: Seconds, from?: UnixTimestamp): UnixTimestamp | null {
		const newExpires = super.updateExpires(key, after, from);
		this.startIfIdle(newExpires);
		return newExpires;
	}

	public resetExpires(): void {
		if (this.iterateTimeoutId !== null) {
			clearTimeout(this.iterateTimeoutId);
			this.iterateTimeoutId = null;
		}
	}

	public expired(_key: Key, _expires: UnixTimestamp | null): boolean {
		return false;
	}

	private cleanup = (): void => {
		let iterations = 0;
		let cacheEntry = this.nextCacheEntry();
		// eslint-disable-next-line no-plusplus
		for (; iterations < this.config.iterateThreshold && cacheEntry !== null; iterations++, cacheEntry = this.nextCacheEntry()) {
			super.expired(cacheEntry.key, cacheEntry.expires);
		}

		// check if we reached end and need to start from beginning
		if (iterations < this.config.iterateThreshold && cacheEntry === null && iterations < this.collectionSize()) {
			// this code was duplicated for speed
			cacheEntry = this.nextCacheEntry(); // reset iterator to begin
			// eslint-disable-next-line no-plusplus
			for (; iterations < this.config.iterateThreshold && cacheEntry !== null; iterations++, cacheEntry = this.nextCacheEntry()) {
				super.expired(cacheEntry.key, cacheEntry.expires);
			}
		}

		if (this.collectionSize() === 0) {
			this.iterateTimeoutId = null;
			return;
		}

		this.iterateTimeoutId = setTimeout(this.cleanup, this.config.checkPeriod);
	};

	private startIfIdle(expires: UnixTimestamp | null): void {
		if (this.iterateTimeoutId === null && expires !== null) {
			this.iterateTimeoutId = setTimeout(this.cleanup, this.config.checkPeriod);
		}
	}

	private static fillWithDefaults<Key>(config: SpeculativeExpirationPolicyConfig<Key>): Config<Key> {
		config.checkPeriod = (config.checkPeriod || 30) * 1000;
		config.iterateThreshold = config.iterateThreshold || 1000;
		return config as Config<Key>;
	}
}

export { SpeculativeExpirationPolicy, ExpirableCacheEntry, NextCacheEntry, QueryCollectionSize, SpeculativeExpirationPolicyConfig };
