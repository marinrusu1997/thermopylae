import { PolicyBasedCache, EntryPoolCacheBackend, ProactiveExpirationPolicy, HeapGarbageCollector } from '@thermopylae/lib.cache';
import type { InvalidAccessTokensCache } from '@thermopylae/lib.jwt-user-session';
import type { Cache, AbsoluteExpirationPolicyArgumentsBundle } from '@thermopylae/lib.cache';
import type { Nullable, UnixTimestamp } from '@thermopylae/core.declarations';

/**
 * Memory cache which holds invalidated access tokens. <br/>
 * Uses *lib.cache* under the hood.
 */
class InvalidAccessTokensMemCache<CacheArgsBundle extends AbsoluteExpirationPolicyArgumentsBundle = AbsoluteExpirationPolicyArgumentsBundle>
	implements InvalidAccessTokensCache
{
	private readonly cache: Cache<string, Nullable<UnixTimestamp>, CacheArgsBundle>;

	/**
	 * @param cache		Cache instance. <br/>
	 * 					Defaults to a new {@link PolicyBasedCache} instance created
	 * 					with {@link EntryPoolCacheBackend}
	 * 					and {@link ProactiveExpirationPolicy} with {@link HeapGarbageCollector}.
	 */
	public constructor(cache?: Cache<string, Nullable<UnixTimestamp>, CacheArgsBundle>) {
		if (cache != null) {
			this.cache = cache;
			return;
		}

		this.cache = new PolicyBasedCache<string, Nullable<UnixTimestamp>, CacheArgsBundle>(new EntryPoolCacheBackend<string, Nullable<UnixTimestamp>>(), [
			new ProactiveExpirationPolicy<string, Nullable<UnixTimestamp>, CacheArgsBundle>(new HeapGarbageCollector())
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

	public clear(): void {
		this.cache.clear();
	}
}

export { InvalidAccessTokensMemCache };
