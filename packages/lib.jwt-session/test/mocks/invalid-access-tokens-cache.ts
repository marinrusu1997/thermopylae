import { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { PolicyBasedCache, AbsoluteExpirationPolicyArgumentsBundle, EsMapCacheBackend, ProactiveExpirationPolicy } from '@thermopylae/lib.cache';
import { InvalidAccessTokensCache } from '../../lib/invalidation-strategy';

class InvalidAccessTokensCacheAdapter implements InvalidAccessTokensCache {
	private readonly cache: PolicyBasedCache<string, UnixTimestamp | null, AbsoluteExpirationPolicyArgumentsBundle>;

	public constructor() {
		const backend = new EsMapCacheBackend<string, UnixTimestamp | null>();
		const policies = [new ProactiveExpirationPolicy<string, UnixTimestamp | null>()];
		this.cache = new PolicyBasedCache(backend, policies);
	}

	public get(refreshTokenAnchor: string): UnixTimestamp | null | undefined {
		return this.cache.get(refreshTokenAnchor);
	}

	public has(refreshTokenAnchor: string): boolean {
		return this.cache.has(refreshTokenAnchor);
	}

	public upset(refreshTokenAnchor: string, invalidatedAt: UnixTimestamp | null, ttl: Seconds): void {
		this.cache.set(refreshTokenAnchor, invalidatedAt, { expiresAfter: ttl });
	}
}

export { InvalidAccessTokensCacheAdapter };
