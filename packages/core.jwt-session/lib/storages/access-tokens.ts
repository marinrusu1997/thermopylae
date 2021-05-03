import type { InvalidAccessTokensCache } from '@thermopylae/lib.jwt-session';
import {
	PolicyBasedCache,
	EntryPoolCacheBackend,
	ProactiveExpirationPolicy,
	HeapGarbageCollector,
	AbsoluteExpirationPolicyArgumentsBundle
} from '@thermopylae/lib.cache';
import type { Nullable, UnixTimestamp } from '@thermopylae/core.declarations';

class InvalidAccessTokensMemCache<CacheArgsBundle extends AbsoluteExpirationPolicyArgumentsBundle = AbsoluteExpirationPolicyArgumentsBundle>
	implements InvalidAccessTokensCache {
	private readonly cache: PolicyBasedCache<string, Nullable<UnixTimestamp>, CacheArgsBundle>;

	public constructor(cache?: PolicyBasedCache<string, Nullable<UnixTimestamp>, CacheArgsBundle>) {
		if (cache != null) {
			this.cache = cache;
			return;
		}

		this.cache = new PolicyBasedCache<string, Nullable<UnixTimestamp>, CacheArgsBundle>(new EntryPoolCacheBackend<string, Nullable<UnixTimestamp>>(), [
			new ProactiveExpirationPolicy<string, Nullable<UnixTimestamp>>(new HeapGarbageCollector())
		]);
	}

	public upset(accessToken: string, invalidatedAt: number | null, ttl: number): void {
		this.cache.set(accessToken, invalidatedAt, { expiresAfter: ttl } as CacheArgsBundle);
	}

	public get(accessToken: string): Nullable<UnixTimestamp> | undefined {
		return this.cache.get(accessToken);
	}

	public has(accessToken: string): boolean {
		return this.cache.has(accessToken);
	}
}

export { InvalidAccessTokensMemCache };
