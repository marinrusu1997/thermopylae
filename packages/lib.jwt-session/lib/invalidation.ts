import { token, chrono } from '@thermopylae/lib.utils';
import { ErrorCodes, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import equals from 'fast-deep-equal';
import type { DeepReadonly } from 'utility-types';
import { createException } from './error';
import { IssuedJwtPayload, UserSessionOperationContext, UserSessionMetaData, QueriedUserSessionMetaData } from './declarations';

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
	readonly token: string;
	/**
	 * Anchor to refresh token.
	 */
	readonly anchor: string;
}

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

/**
 * External persistent storage where refresh tokens are kept.
 */
interface RefreshTokensStorage {
	/**
	 * Insert refresh token.
	 *
	 * @param subject			Subject refresh token belongs to.
	 * @param refreshToken		Refresh token.
	 * @param metaData			User session metadata.
	 * @param ttl				TTL of the refresh token.
	 */
	insert(subject: string, refreshToken: string, metaData: UserSessionMetaData, ttl: Seconds): Promise<void>;

	/**
	 * Read user session associated with `refreshToken`.
	 *
	 * @param subject			Subject refresh token belongs to.
	 * @param refreshToken		Refresh token.
	 *
	 * @returns		User session metadata.
	 */
	read(subject: string, refreshToken: string): Promise<UserSessionMetaData | undefined>;

	/**
	 * Read all of the **active** user sessions.
	 *
	 * @param subject		Subject user sessions are belonging to.
	 *
	 * @returns			Refresh tokens with the sessions metadata.
	 */
	readAll(subject: string): Promise<Array<UserSessionMetaData>>;

	/**
	 * Delete `refreshToken` from the storage.
	 *
	 * @param subject			Subject refresh token belongs to.
	 * @param refreshToken		Refresh token.
	 */
	delete(subject: string, refreshToken: string): Promise<void>;

	/**
	 * Delete all refresh tokens that belong to `subject`.
	 *
	 * @param subject			Subject refresh tokens belonging to.
	 *
	 * @returns		Number of deleted tokens.
	 */
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

	/**
	 * @param options		Options object. <br/>
	 * 						It should not be modified after, as it will be used by strategy without being cloned.
	 */
	public constructor(options: InvalidationStrategyOptions) {
		if (options.refreshTokenLength < 20) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Refresh token length can't be lower than 20 characters. Given: ${options.refreshTokenLength}.`);
		}
		this.options = options;
	}

	/**
	 * Generates anchorable refresh token.
	 *
	 * @param subject			Subject of the access token. <br/>
	 * 							Usually this is the user/account id.
	 * @param context			User session creation context.
	 *
	 * @returns		Anchorable refresh token.
	 */
	public async generateRefreshToken(subject: string, context: UserSessionOperationContext): Promise<AnchorableRefreshToken> {
		const refreshToken = token.generate(token.TokenGenerationType.CRYPTOGRAPHIC, this.options.refreshTokenLength);
		(context as UserSessionMetaData).createdAt = chrono.unixTime();

		await this.options.refreshTokensStorage.insert(subject, refreshToken, context as UserSessionMetaData, this.options.refreshTokenTtl);
		return { token: refreshToken, anchor: refreshToken.slice(0, InvalidationStrategy.ANCHOR_TO_REFRESH_TOKEN_LENGTH) };
	}

	/**
	 * Check whether JWT Access Token is still valid. <br/>
	 * Do not confuse it with expiration, as the token might not be expired, but it was forcibly invalidated.
	 *
	 * @param jwtAccessToken	Access token.
	 */
	public isAccessTokenStillValid(jwtAccessToken: Readonly<IssuedJwtPayload>): boolean {
		if (this.options.invalidAccessTokensCache.has(`${jwtAccessToken.sub}@${jwtAccessToken.anc}`)) {
			return false;
		}

		const invalidateAllSessionsTimestamp = this.options.invalidAccessTokensCache.get(`${jwtAccessToken.sub}@${InvalidationStrategy.ALL_SESSIONS_WILDCARD}`);
		return !(typeof invalidateAllSessionsTimestamp === 'number' && jwtAccessToken.iat <= invalidateAllSessionsTimestamp);
	}

	/**
	 * Refreshes access token session.
	 *
	 * @param subject			Subject whose session needs to be refreshed.
	 * @param refreshToken		Refresh token of the subject.
	 * @param context			Refresh context.
	 *
	 * @throws {Exception}		When:
	 * 								- refresh token doesn't exist.
	 * 								- device from refresh context differs from user session metadata device.
	 *
	 * @returns					Anchor to refresh token.
	 */
	public async refreshAccessSession(subject: string, refreshToken: string, context: DeepReadonly<UserSessionOperationContext>): Promise<string> {
		const userSessionMetadata = await this.options.refreshTokensStorage.read(subject, refreshToken);
		if (!userSessionMetadata) {
			throw createException(ErrorCodes.NOT_FOUND, `Refresh token ${refreshToken} for subject ${subject} doesn't exist.`);
		}

		if (!equals(context.device, userSessionMetadata.device)) {
			throw createException(
				ErrorCodes.NOT_EQUAL,
				`Attempting to regenerate access token with refresh token ${refreshToken} for subject ${subject}` +
					`from context that differs from user session metadata. Refresh context: ${JSON.stringify(context)}. User session metadata: ${JSON.stringify(
						userSessionMetadata
					)}`
			);
		}

		return refreshToken.slice(0, InvalidationStrategy.ANCHOR_TO_REFRESH_TOKEN_LENGTH);
	}

	/**
	 * Get all of the active user sessions.
	 *
	 * @param subject		Subject sessions of which need to be retrieved.
	 *
	 * @returns				Active user sessions.
	 */
	public async getActiveUserSessions(subject: string): Promise<Array<DeepReadonly<QueriedUserSessionMetaData>>> {
		const activeSessions = await this.options.refreshTokensStorage.readAll(subject);
		for (const session of activeSessions) {
			(session as QueriedUserSessionMetaData).expiresAt = session.createdAt + this.options.refreshTokenTtl;
		}
		return activeSessions as Array<QueriedUserSessionMetaData>;
	}

	/**
	 * Invalidate user session associated with JWT Access Token.
	 *
	 * @param jwtAccessToken	Access token.
	 * @param refreshToken		Refresh token.
	 */
	public async invalidateSession(jwtAccessToken: Readonly<IssuedJwtPayload>, refreshToken: string): Promise<void> {
		await this.options.refreshTokensStorage.delete(jwtAccessToken.sub, refreshToken);
		this.invalidateAccessToken(jwtAccessToken);
	}

	/**
	 * Invalidate all user sessions.
	 *
	 * @param jwtAccessToken	Access token of the session from where invalidation operation is made.
	 *
	 * @returns		Number of invalidated sessions.
	 */
	public async invalidateAllSessions(jwtAccessToken: Readonly<IssuedJwtPayload>): Promise<number> {
		const invalidatedSessions = await this.options.refreshTokensStorage.deleteAll(jwtAccessToken.sub);
		this.invalidateAccessTokensFromAllSessions(jwtAccessToken);
		return invalidatedSessions;
	}

	/**
	 * Invalidates JWT Access Token, so that it can't be longer used, despite it's not expired yet. <br/>
	 * **Notice** that session associated with `jwtAccessToken` won't be invalidated,
	 * meaning that user can obtain another access token with the help of refresh token.
	 *
	 * @param jwtAccessToken	Access token that needs to be invalidated.
	 */
	public invalidateAccessToken(jwtAccessToken: Readonly<IssuedJwtPayload>): void {
		const invalidationKey = `${jwtAccessToken.sub}@${jwtAccessToken.anc}`;
		const invalidationTtl = jwtAccessToken.exp - jwtAccessToken.iat;

		this.options.invalidAccessTokensCache.upset(invalidationKey, null, invalidationTtl);
	}

	/**
	 * Invalidates all JWT Access Tokens that were issued up to current timestamp from all existing user sessions. <br/>
	 * **Notice** that associated user sessions won't be invalidated,
	 * meaning that the user can obtain another access tokens from them by using their refresh tokens.
	 *
	 * @param jwtAccessToken	Access token of the session from where invalidation is being made.
	 */
	public invalidateAccessTokensFromAllSessions(jwtAccessToken: Readonly<IssuedJwtPayload>): void {
		const invalidationKey = `${jwtAccessToken.sub}@${InvalidationStrategy.ALL_SESSIONS_WILDCARD}`;
		// all of the tokens issues before this timestamp becomes invalid ones
		const invalidatedAt = chrono.unixTime();
		// those issued nearly invalidation timestamp will have a ttl less than or equal to this one (assuming access tokens for one subject will have same ttl across all sessions)
		const invalidationTtl = jwtAccessToken.exp - jwtAccessToken.iat;

		this.options.invalidAccessTokensCache.upset(invalidationKey, invalidatedAt, invalidationTtl);
	}
}

export { InvalidationStrategy, InvalidationStrategyOptions, AnchorableRefreshToken, InvalidAccessTokensCache, RefreshTokensStorage };
