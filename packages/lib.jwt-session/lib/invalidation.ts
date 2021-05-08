import { ErrorCodes, MutableSome, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import safeUid from 'uid-safe';
import type { DeepReadonly } from 'utility-types';
import { createException } from './error';
import { DeviceBase, IssuedJwtPayload, QueriedUserSessionMetaData, UserSessionMetaData, UserSessionOperationContext } from './declarations';

// Reference Links:
//	https://medium.com/@benjamin.botto/secure-access-token-storage-with-single-page-applications-part-1-9536b0021321
//	https://medium.com/@benjamin.botto/secure-access-token-storage-with-single-page-applications-part-2-921fce24e1b5
//	https://security.stackexchange.com/questions/223134/how-to-invalidate-jwt-tokens-without-a-database-lookup-with-each-request-to-the
//	https://medium.com/lightrail/getting-token-authentication-right-in-a-stateless-single-page-application-57d0c6474e3
//	https://medium.com/@ideneal/securing-authentication-in-a-spa-using-jwt-token-the-coolest-way-ab883bc372b6
//	https://markitzeroday.com/x-requested-with/cors/2017/06/29/csrf-mitigation-for-ajax-requests.html
//	https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/#logout_token_invalidation

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
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
interface RefreshTokensStorage<Device extends DeviceBase, Location> {
	/**
	 * Insert refresh token.
	 *
	 * > **IMPORTANT!** <br/>
	 * > It's highly advisable to hash refresh token before storing it in the database,
	 * > especially if RDBMS is used.
	 *
	 * @param subject			Subject refresh token belongs to.
	 * @param refreshToken		Refresh token.
	 * @param metaData			User session metadata.
	 * @param ttl				TTL of the refresh token.
	 */
	insert(subject: string, refreshToken: string, metaData: UserSessionMetaData<Device, Location>, ttl: Seconds): Promise<void>;

	/**
	 * Read user session associated with `refreshToken`.
	 *
	 * @param subject			Subject refresh token belongs to.
	 * @param refreshToken		Refresh token.
	 *
	 * @returns		User session metadata or *undefined* if not found.
	 */
	read(subject: string, refreshToken: string): Promise<UserSessionMetaData<Device, Location> | undefined>;

	/**
	 * Read all of the **active** user sessions.
	 *
	 * @param subject	Subject user sessions are belonging to.
	 *
	 * @returns			Refresh tokens with the sessions metadata. <br/>
	 * 					When subject has no active sessions, returns an empty array.
	 */
	readAll(subject: string): Promise<ReadonlyMap<string, UserSessionMetaData<Device, Location>>>;

	/**
	 * Delete `refreshToken` from the storage.
	 *
	 * @param subject			Subject refresh token belongs to.
	 * @param refreshToken		Refresh token.
	 *
	 * @throws	{Error}			When `subject` not found.
	 * @throws	{Error}			When `refreshToken` not found.
	 */
	delete(subject: string, refreshToken: string): Promise<void>;

	/**
	 * Delete all refresh tokens that belong to `subject`.
	 *
	 * @param subject			Subject refresh tokens belonging to.
	 *
	 * @throws	{Error}			When `subject` not found.
	 *
	 * @returns		Number of deleted tokens.
	 */
	deleteAll(subject: string): Promise<number>;
}

/**
 * Hook called on refresh token renewal.
 *
 * @param subject			Subject.
 * @param context			Refresh access token operation context.
 * @param sessionMetaData	Session meta-data that was retrieved from storage.
 *
 * @throws 	In case some anomalies are detected between renewal context and session metadata,
 * 			an exception should be thrown to stop renewal operation.
 */
type RefreshAccessTokenHook<Device extends DeviceBase, Location> = (
	subject: string,
	context: UserSessionOperationContext<Device, Location>,
	sessionMetaData: Readonly<UserSessionMetaData<Device, Location>>
) => void;

interface InvalidationStrategyOptions<Device extends DeviceBase, Location> {
	/**
	 * Length of the refresh token. <br/>
	 * Because base64 encoding is used underneath, this is not the string length.
	 * For example, to create a token of length 24, you want a byte length of 18. <br/>
	 * Value of this option should not be lower than 15.
	 */
	readonly refreshTokenLength: number;
	/**
	 * TTL if the refresh token.
	 */
	readonly refreshTokenTtl: Seconds;
	/**
	 * Cache where invalid access tokens will be stored.
	 */
	readonly invalidAccessTokensCache: InvalidAccessTokensCache;
	/**
	 * Storage where refresh tokens will be placed.
	 */
	readonly refreshTokensStorage: RefreshTokensStorage<Device, Location>;
	/**
	 * Refresh access token hook. <br/>
	 * Defaults to hook which ensures that in case device is present in both context and session metadata,
	 * their *name* and *type* needs to be equal.
	 */
	readonly refreshAccessTokenHook?: RefreshAccessTokenHook<Device, Location>;
}

/**
 * Invalidation strategy for JWT Access Tokens.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
class InvalidationStrategy<Device extends DeviceBase, Location> {
	private static readonly ANCHOR_TO_REFRESH_TOKEN_LENGTH = 5;

	private static readonly ALL_SESSIONS_WILDCARD = '*';

	private readonly options: Required<InvalidationStrategyOptions<Device, Location>>;

	/**
	 * @param options		Options object. <br/>
	 * 						It should not be modified after, as it will be used by strategy without being cloned.
	 */
	public constructor(options: InvalidationStrategyOptions<Device, Location>) {
		if (options.refreshTokenLength < 15) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Refresh token length can't be lower than 15 characters. Given: ${options.refreshTokenLength}.`);
		}

		if (options.refreshAccessTokenHook == null) {
			(options as MutableSome<InvalidationStrategyOptions<Device, Location>, 'refreshAccessTokenHook'>).refreshAccessTokenHook =
				InvalidationStrategy.refreshAccessTokenHook;
		}

		this.options = options as Required<InvalidationStrategyOptions<Device, Location>>;
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
	public async generateRefreshToken(subject: string, context: UserSessionOperationContext<Device, Location>): Promise<AnchorableRefreshToken> {
		const refreshToken = await safeUid(this.options.refreshTokenLength);
		(context as UserSessionMetaData<Device, Location>).createdAt = InvalidationStrategy.currentTimestamp();

		await this.options.refreshTokensStorage.insert(subject, refreshToken, context as UserSessionMetaData<Device, Location>, this.options.refreshTokenTtl);
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
	 * Refreshes access token to user session.
	 *
	 * @param subject			Subject whose session needs to be refreshed.
	 * @param refreshToken		Refresh token of the subject.
	 * @param context			Refresh context.
	 *
	 * @throws {Exception}		When:
	 * 								- refresh token doesn't exist.
	 * 								- device from refresh context differs from user session metadata device
	 * 								  (in case default {@link InvalidationStrategyOptions.refreshAccessTokenHook} is used).
	 *
	 * @returns					Anchor to refresh token.
	 */
	public async refreshSessionAccessToken(subject: string, refreshToken: string, context: UserSessionOperationContext<Device, Location>): Promise<string> {
		const userSessionMetadata = await this.options.refreshTokensStorage.read(subject, refreshToken);
		if (!userSessionMetadata) {
			throw createException(ErrorCodes.NOT_FOUND, `Refresh token '${refreshToken}' for subject ${subject} doesn't exist.`);
		}

		this.options.refreshAccessTokenHook(subject, context, userSessionMetadata);

		return refreshToken.slice(0, InvalidationStrategy.ANCHOR_TO_REFRESH_TOKEN_LENGTH);
	}

	/**
	 * Get all of the active user sessions.
	 *
	 * @param subject		Subject sessions of which need to be retrieved.
	 *
	 * @returns				Active user sessions with their refresh tokens.
	 */
	public async getActiveUserSessions(subject: string): Promise<ReadonlyMap<string, DeepReadonly<QueriedUserSessionMetaData<Device, Location>>>> {
		const activeSessions = await this.options.refreshTokensStorage.readAll(subject);
		for (const session of activeSessions.values()) {
			(session as QueriedUserSessionMetaData<Device, Location>).expiresAt = session.createdAt + this.options.refreshTokenTtl;
		}
		return activeSessions as ReadonlyMap<string, DeepReadonly<QueriedUserSessionMetaData<Device, Location>>>;
	}

	/**
	 * Invalidate user session associated with refresh token.
	 *
	 * @param subject			Subject of the session.
	 * @param refreshToken		Refresh token.
	 */
	public invalidateSession(subject: string, refreshToken: string): Promise<void> {
		return this.options.refreshTokensStorage.delete(subject, refreshToken);
	}

	/**
	 * Invalidate all user sessions.
	 *
	 * @param subject	Subject.
	 *
	 * @returns		Number of invalidated sessions.
	 */
	public invalidateAllSessions(subject: string): Promise<number> {
		return this.options.refreshTokensStorage.deleteAll(subject);
	}

	/**
	 * Invalidates JWT Access Token, so that it can't be longer used, despite it's not expired yet. <br/>
	 * **Notice** that session associated with `jwtAccessToken` won't be invalidated,
	 * meaning that user can obtain another access token with the help of refresh token.
	 *
	 * @param jwtAccessToken	Access token that needs to be invalidated.
	 */
	public invalidateAccessToken(jwtAccessToken: IssuedJwtPayload): void {
		const invalidationKey = `${jwtAccessToken.sub}@${jwtAccessToken.anc}`;
		const invalidationTtl = jwtAccessToken.exp - jwtAccessToken.iat;

		this.options.invalidAccessTokensCache.upset(invalidationKey, null, invalidationTtl);
	}

	/**
	 * Invalidates all JWT Access Tokens that were issued up to current timestamp from all existing user sessions. <br/>
	 * **Notice** that associated user sessions won't be invalidated,
	 * meaning that the user can obtain another access tokens from them by using their refresh tokens.
	 *
	 * @param subject				Subject.
	 * @param jwtAccessTokenTtl		Ttl of the issued before access tokens to `subject`;
	 */
	public invalidateAccessTokensFromAllSessions(subject: string, jwtAccessTokenTtl: Seconds): void {
		const invalidationKey = `${subject}@${InvalidationStrategy.ALL_SESSIONS_WILDCARD}`;
		// all of the tokens issues before this timestamp becomes invalid ones
		const invalidatedAt = InvalidationStrategy.currentTimestamp();
		// those issued nearly invalidation timestamp will have a ttl less than or equal to this one
		// (assuming access tokens for one subject will have same ttl across all sessions)

		this.options.invalidAccessTokensCache.upset(invalidationKey, invalidatedAt, jwtAccessTokenTtl);
	}

	private static refreshAccessTokenHook<Dev extends DeviceBase, Loc>(
		subject: string,
		context: UserSessionOperationContext<Dev, Loc>,
		sessionMetaData: Readonly<UserSessionMetaData<Dev, Loc>>
	): void {
		if (context.device && sessionMetaData.device) {
			if (context.device.type !== sessionMetaData.device.type || context.device.name !== sessionMetaData.device.name) {
				throw createException(
					ErrorCodes.NOT_EQUAL,
					`Attempting to regenerate access token for subject '${subject}'` +
						`from context that differs from user session metadata. Refresh token context: ${JSON.stringify(
							context
						)}. User session metadata: ${JSON.stringify(sessionMetaData)}`
				);
			}
		}
	}

	private static currentTimestamp(): UnixTimestamp {
		return Math.floor(new Date().getTime() / 1000);
	}
}

export { InvalidationStrategy, InvalidationStrategyOptions, AnchorableRefreshToken, InvalidAccessTokensCache, RefreshTokensStorage, RefreshAccessTokenHook };
