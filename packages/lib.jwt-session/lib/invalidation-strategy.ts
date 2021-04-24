import { token, chrono } from '@thermopylae/lib.utils';
import { ErrorCodes, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { createException } from './error';
import { IssuedJwtPayload } from './declarations';

// FIXME reference links
//	https://medium.com/@benjamin.botto/secure-access-token-storage-with-single-page-applications-part-1-9536b0021321
//	https://medium.com/@benjamin.botto/secure-access-token-storage-with-single-page-applications-part-2-921fce24e1b5
//	https://security.stackexchange.com/questions/223134/how-to-invalidate-jwt-tokens-without-a-database-lookup-with-each-request-to-the
//	https://medium.com/lightrail/getting-token-authentication-right-in-a-stateless-single-page-application-57d0c6474e3
//	https://medium.com/@ideneal/securing-authentication-in-a-spa-using-jwt-token-the-coolest-way-ab883bc372b6
//	https://markitzeroday.com/x-requested-with/cors/2017/06/29/csrf-mitigation-for-ajax-requests.html
//	https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/#logout_token_invalidation

// @fixme lib.jwt-session manages JWT and refresh tokens
// @fixme app.jwt.http manages jwt cookies and refresh over HTTPS

/**
 * Refresh token that will be anchored to **access token**.
 */
declare interface AnchorableRefreshToken {
	/**
	 * The actual refresh token.
	 */
	token: string;
	/**
	 * Anchor to refresh token.
	 */
	anchor: string;
}

interface RefreshedAccessSession {
	/**
	 * Anchor to refresh token.
	 */
	refreshAnchor: string;
	/**
	 * Time to live for the refreshed access token.
	 */
	accessTokenTtl: Seconds;
}

interface InvalidAccessTokensCache {
	upset(refreshTokenAnchor: string, invalidatedAt: UnixTimestamp | null, ttl: Seconds): void;
	has(refreshTokenAnchor: string): boolean;
	get(refreshTokenAnchor: string): UnixTimestamp | null | undefined;
}

interface RefreshTokensStorage {
	set(subject: string, refreshToken: string, ttl: Seconds): Promise<void>;
	get(subject: string, refreshToken: string): Promise<UnixTimestamp | undefined>;
	delete(subject: string, refreshToken: string): Promise<boolean>;
	deleteAll(subject: string): Promise<number>;
}

interface InvalidationStrategyOptions {
	/**
	 * Length of the refresh token. Should not be lower than 20 characters.
	 */
	refreshTokenLength: number;
	/**
	 * TTL if the refresh token.
	 */
	refreshTokenTtl: Seconds;
	/**
	 * Cache where invalid access tokens will be stored.
	 */
	invalidAccessTokensCache: InvalidAccessTokensCache;
	/**
	 * Storage where refresh tokens will be placed.
	 */
	refreshTokensStorage: RefreshTokensStorage;
}

/**
 * Invalidation strategy for JWT Access Tokens.
 */
class InvalidationStrategy {
	private static readonly ANCHOR_TO_REFRESH_TOKEN_LENGTH = 5;

	private static readonly ALL_SESSIONS_WILDCARD = '*';

	private readonly options: InvalidationStrategyOptions;

	public constructor(options: InvalidationStrategyOptions) {
		if (options.refreshTokenLength < 20) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Refresh token length can't be lower than 20 characters. Given: ${options.refreshTokenLength}.`);
		}
		this.options = options;
	}

	/**
	 * Generates anchorable refresh token.
	 *
	 * @param subject	Subject of the access token. <br/>
	 * 					Usually this is the user/account id.
	 *
	 * @returns		Anchorable refresh token.
	 */
	public async generateRefreshToken(subject: string): Promise<AnchorableRefreshToken> {
		const refreshToken = token.generate(token.TokenGenerationType.CRYPTOGRAPHIC, this.options.refreshTokenLength);
		await this.options.refreshTokensStorage.set(subject, refreshToken, this.options.refreshTokenTtl);
		return { token: refreshToken, anchor: refreshToken.slice(0, InvalidationStrategy.ANCHOR_TO_REFRESH_TOKEN_LENGTH) };
	}

	/**
	 * Check whether JWT Access Token is still valid. <br/>
	 * Do not confuse it with expiration, as the token might not be expired, but it was forcibly invalidated.
	 *
	 * @param jwtAccessToken	Access token.
	 */
	public isAccessTokenStillValid(jwtAccessToken: IssuedJwtPayload): boolean {
		if (this.options.invalidAccessTokensCache.has(`${jwtAccessToken.sub}@${jwtAccessToken.anc}`)) {
			return false;
		}

		const invalidateAllSessionsTimestamp = this.options.invalidAccessTokensCache.get(`${jwtAccessToken.sub}@${InvalidationStrategy.ALL_SESSIONS_WILDCARD}`);
		return !(typeof invalidateAllSessionsTimestamp === 'number' && jwtAccessToken.iat <= invalidateAllSessionsTimestamp);
	}

	/**
	 * Refreshes access token session. <br/>
	 * In case `accessTokenTtl` is lower than the remaining ttl of the refresh token, it's value will be updated with the latest.
	 *
	 * @param subject			Subject whose session needs to be refreshed.
	 * @param refreshToken		Refresh token of the subject.
	 * @param accessTokenTtl	Ttl of the access token.
	 *
	 * @throws {Exception}		When:
	 * 								- refresh token doesn't exist
	 * 								- refresh token has a remaining ttl <= 1 second
	 *
	 * @returns					Refreshed access token session.
	 */
	public async refreshAccessSession(subject: string, refreshToken: string, accessTokenTtl: Seconds): Promise<RefreshedAccessSession> {
		const expiresAt = await this.options.refreshTokensStorage.get(subject, refreshToken);
		if (typeof expiresAt !== 'number') {
			throw createException(ErrorCodes.NOT_FOUND, `Refresh token ${refreshToken} for subject ${subject} doesn't exist.`);
		}

		const refreshTokenRemainingTtl = expiresAt - chrono.unixTime();
		if (refreshTokenRemainingTtl <= 1) {
			throw createException(
				ErrorCodes.EXPIRED,
				`Refresh token ${refreshToken} for subject ${subject} is almost expired. It's remaining time to live is equal to ${refreshTokenRemainingTtl} seconds.`
			);
		}

		return {
			refreshAnchor: refreshToken.slice(0, InvalidationStrategy.ANCHOR_TO_REFRESH_TOKEN_LENGTH),
			accessTokenTtl: Math.min(accessTokenTtl, refreshTokenRemainingTtl)
		};
	}

	/**
	 * Invalidate user session associated with JWT Access Token.
	 *
	 * @param jwtAccessToken	Access token.
	 * @param refreshToken		Refresh token.
	 */
	public async invalidateSession(jwtAccessToken: IssuedJwtPayload, refreshToken: string): Promise<boolean> {
		if (!(await this.options.refreshTokensStorage.delete(jwtAccessToken.sub, refreshToken))) {
			// this might happen if either:
			//	- refresh token was not valid
			//  - refresh token was invalidated in the last second of it's lifetime (i.e. it was evicted by the storage itself implicitly)
			return false;
		}

		const invalidationKey = `${jwtAccessToken.sub}@${jwtAccessToken.anc}`;
		const invalidationTtl = jwtAccessToken.exp - jwtAccessToken.iat;
		this.options.invalidAccessTokensCache.upset(invalidationKey, null, invalidationTtl);

		return true;
	}

	/**
	 * Invalidate all user sessions.
	 *
	 * @param jwtAccessToken	Access token of the session from where invalidation operation is made.
	 *
	 * @returns		Number of invalidated sessions.
	 */
	public async invalidateAllSessions(jwtAccessToken: IssuedJwtPayload): Promise<number> {
		const invalidatedSessions = await this.options.refreshTokensStorage.deleteAll(jwtAccessToken.sub);

		const invalidationKey = `${jwtAccessToken.sub}@${InvalidationStrategy.ALL_SESSIONS_WILDCARD}`;
		// all of the tokens issues before this timestamp becomes invalid ones
		const invalidatedAt = chrono.unixTime();
		// those issued nearly invalidation timestamp will have a ttl less than or equal to this one (assuming access tokens for one subject will have same ttl across all sessions)
		const invalidationTtl = jwtAccessToken.exp - jwtAccessToken.iat;
		this.options.invalidAccessTokensCache.upset(invalidationKey, invalidatedAt, invalidationTtl);

		return invalidatedSessions;
	}
}

export { InvalidationStrategy, InvalidationStrategyOptions, AnchorableRefreshToken, RefreshedAccessSession, InvalidAccessTokensCache, RefreshTokensStorage };
