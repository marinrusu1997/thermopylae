import type { Seconds, UnixTimestamp } from '@thermopylae/core.declarations';

/**
 * *In-memory* cache where invalid access tokens are stored.
 */
interface InvalidAccessTokensCache {
	/**
	 * Upset access token.
	 *
	 * @param accessToken		Access token that's no longer valid.
	 * @param invalidatedAt		Invalidation timestamp.
	 * @param ttl				How many seconds invalid access token should be kept in the cache.
	 */
	upset(accessToken: string, invalidatedAt: UnixTimestamp | null, ttl: Seconds): void;

	/**
	 * Check for access token existence in the cache. <br/>
	 * If found, it means access token is no longer valid.
	 *
	 * @param accessToken		Access token.
	 */
	has(accessToken: string): boolean;

	/**
	 * Get invalidation timestamp of the access token.
	 *
	 * @param accessToken		Access token.
	 *
	 * @returns		Invalidation timestamp or *undefined* if `accessToken` was not present in the cache.
	 */
	get(accessToken: string): UnixTimestamp | null | undefined;
}

export { InvalidAccessTokensCache };
