import { ErrorCodes } from '@thermopylae/core.declarations';
import type { MutableSome, PublicPrivateKeys, RequireAtLeastOne, RequireSome, Seconds } from '@thermopylae/core.declarations';
import type { DeviceBase, SessionId, Subject, UserSessionMetaData, UserSessionOperationContext } from '@thermopylae/lib.user-session.commons';
import type { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { sign, verify } from 'jsonwebtoken';
import { EventEmitter } from 'events';
import type { IssuedJwtPayload, JwtPayload } from './declarations';
import { createException } from './error';
import type { InvalidationStrategyOptions } from './invalidation';
import { InvalidationStrategy } from './invalidation';

/**
 * Payload of the JWT that will be actually signed.
 *
 * @private
 */
interface SignableJwtPayload extends JwtPayload {
	/**
	 * Anchored refresh token.
	 * Represents a sub-part (usually the first 6 letters) of the refresh token.
	 * Anchor is used for invalidation purposes.
	 */
	readonly anc: string;
}

/**
 * Signing options for Json Web Token.
 */
type JwtSignOptions<T extends SignOptions = SignOptions> = Readonly<Omit<T, 'mutatePayload' | 'noTimestamp' | 'header' | 'encoding'>>;

/**
 * Verifying options for Json Web Token
 */
type JwtVerifyOptions = Readonly<
	Omit<RequireSome<VerifyOptions, 'algorithms' | 'audience' | 'issuer'>, 'complete' | 'ignoreExpiration' | 'ignoreNotBefore' | 'clockTimestamp'>
>;

interface JwtUserSessionManagerOptions<Device extends DeviceBase = DeviceBase, Location = string> {
	/**
	 * Secret used for JWT signing and verify.
	 */
	readonly secret: string | Buffer | PublicPrivateKeys;
	/**
	 * Options for invalidation strategy. <br/>
	 * **Note!** They should not be modified after,
	 * as this object will be used by invalidation strategy without being cloned.
	 */
	readonly invalidationOptions: InvalidationStrategyOptions<Device, Location>;
	/**
	 * Default sign options.
	 */
	readonly signOptions: JwtSignOptions<RequireSome<SignOptions, 'algorithm' | 'expiresIn' | 'issuer' | 'audience'>>;
	/**
	 * Default verify options.
	 */
	readonly verifyOptions: JwtVerifyOptions;
}

/**
 * Tokens which represents the client session.
 */
interface SessionTokens {
	/**
	 * JWT access token used to interact with Web API.
	 */
	readonly accessToken: string;
	/**
	 * Refresh token used to refresh {@link SessionTokens.accessToken}.
	 */
	readonly refreshToken: string;
}

const enum JwtUserSessionManagerEvent {
	SESSION_INVALIDATED = 'SESSION_INVALIDATED',
	ALL_SESSIONS_INVALIDATED = 'ALL_SESSIONS_INVALIDATED'
}

/**
 * Stateless implementation of the user sessions using JWT as exchange mechanism.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
class JwtUserSessionManager<Device extends DeviceBase = DeviceBase, Location = string> extends EventEmitter {
	private readonly config: JwtUserSessionManagerOptions<Device, Location>;

	private readonly invalidationStrategy: InvalidationStrategy<Device, Location>;

	/**
	 * @param options		Options object. <br/>
	 * 						It should not be modified after, as it will be used without being cloned.
	 */
	public constructor(options: JwtUserSessionManagerOptions<Device, Location>) {
		super();
		this.config = JwtUserSessionManager.fillWithDefaults(options);
		this.invalidationStrategy = new InvalidationStrategy(options.invalidationOptions);
	}

	/**
	 * Create user session.
	 *
	 * @param payload			JWT payload. <br/>
	 * 							The object will be modified *in-place*.
	 * @param signOptions		Sign options. <br/>
	 * 							Provided properties will override the default ones.
	 * @param context			User session creation context. <br/>
	 * 							Context won't be cloned, therefore you should not update it after operation finishes.
	 * @param refreshTokenTtl	Refresh token ttl. When given, will have priority over the default one.
	 *
	 * @returns 	Session access and refresh tokens.
	 */
	public async create(
		payload: JwtPayload,
		signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>,
		context: UserSessionOperationContext<Device, Location>,
		refreshTokenTtl?: Seconds
	): Promise<SessionTokens> {
		signOptions = { ...this.config.signOptions, ...signOptions };

		const anchorableRefreshToken = await this.invalidationStrategy.generateRefreshToken(signOptions.subject, context, refreshTokenTtl);
		const accessToken = await this.issueJWT(payload, anchorableRefreshToken.anchor, signOptions);

		return { accessToken, refreshToken: anchorableRefreshToken.token };
	}

	/**
	 * Read JWT payload from access token. <br/>
	 * Token will be validated before being decoded and it's payload extracted.
	 *
	 * @param jwtAccessToken	Access token.
	 * @param verifyOptions		Verify options. <br/>
	 * 							Provided properties will override the default ones.
	 *
	 * @throws {TokenExpiredError}	When token is expired.
	 * @throws {JsonWebTokenError}	When token is invalid.
	 * @throws {NotBeforeError}		When token is used before its activation timestamp.
	 * @throws {Exception}			When token was invalided with error code {@link ErrorCodes.INVALID}.
	 *
	 * @returns		JWT access token payload.
	 */
	public async read(jwtAccessToken: string, verifyOptions?: JwtVerifyOptions): Promise<IssuedJwtPayload> {
		verifyOptions = verifyOptions ? { ...this.config.verifyOptions, ...verifyOptions } : this.config.verifyOptions;
		const secret = this.getSecret('public');

		return new Promise<IssuedJwtPayload>((resolve, reject) =>
			verify(jwtAccessToken, secret, verifyOptions, (verifyError, decoded) => {
				if (verifyError) {
					return reject(verifyError);
				}

				try {
					if (this.invalidationStrategy.isAccessTokenStillValid(decoded as IssuedJwtPayload)) {
						return resolve(decoded as IssuedJwtPayload);
					}

					return reject(createException(ErrorCodes.INVALID, `Token '${jwtAccessToken}' was forcibly invalidated.`));
				} catch (e) {
					return reject(e);
				}
			})
		);
	}

	/**
	 * Read all the **active** sessions of the `subject`. <br/>
	 * **Note!** Session objects are returned directly from storage, without being cloned,
	 * therefore you are not advised to modify them after this operation.
	 *
	 * @param subject		Subject from the JWT (i.e. user/account id).
	 *
	 * @returns				Refresh tokens mapped to session metadata.
	 */
	public readAll(subject: Subject): Promise<ReadonlyMap<SessionId, UserSessionMetaData<Device, Location>>> {
		return this.invalidationStrategy.getActiveUserSessions(subject);
	}

	/**
	 * Update user access token session.
	 *
	 * @param refreshToken		Refresh token.
	 * @param payload			Payload for the newly access token. <br/>
	 * 							The object will be modified *in-place*.
	 * @param signOptions		Sign options. Provided properties will override the default ones.
	 * @param context			Update access token context.
	 *
	 * @throws {Exception}		When:
	 * 								- refresh token is not valid.
	 * 								- update is performed from a device different than the one from where session was created
	 * 								  (in case default {@link InvalidationStrategyOptions.refreshAccessTokenHook} is used).
	 *
	 * @returns		JWT access token.
	 */
	public async update(
		refreshToken: SessionId,
		payload: JwtPayload,
		signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>,
		context: UserSessionOperationContext<Device, Location>
	): Promise<string> {
		signOptions = { ...this.config.signOptions, ...signOptions };

		const anchorToRefreshToken = await this.invalidationStrategy.refreshSessionAccessToken(signOptions.subject, refreshToken, context);
		return this.issueJWT(payload, anchorToRefreshToken, signOptions);
	}

	/**
	 * Delete one user session associated with refresh token.
	 *
	 * @param subject			Subject (i.e. user/account).
	 * @param refreshToken		Refresh token.
	 * @param jwtPayload		Payload of the access token. <br/>
	 * 							When provided will also invalidate this access token. <br/>
	 * 							Parameter is optional, so that admins that may not have access token can invalidate user session.
	 *
	 * @emits {@link JwtUserSessionManagerEvent.SESSION_INVALIDATED} When `jwtPayload` parameter is given. If you use multiple {@link JwtUserSessionManager} instances, you are strongly advised to call {@link JwtUserSessionManager.restrictOne} on other instances when this event is emitted.
	 */
	public async deleteOne(subject: Subject, refreshToken: SessionId, jwtPayload?: IssuedJwtPayload): Promise<void> {
		await this.invalidationStrategy.invalidateSession(subject, refreshToken);
		if (jwtPayload) {
			this.invalidationStrategy.invalidateAccessToken(jwtPayload);
			this.emit(JwtUserSessionManagerEvent.SESSION_INVALIDATED, jwtPayload);
		}
	}

	/**
	 * Deletes all of the user sessions.
	 *
	 * @param subject			Subject (i.e. user/account id).
	 * @param jwtPayload		Payload of the access token. <br/>
	 * 							Access token belongs to session from where invalidation occurs. <br/>
	 * 							Parameter is optional, so that an admin can invalidate all user sessions without having his access token. <br/>
	 * 							Notice that in case `jwtPayload` is not provided, access token ttl will be taken from default {@link JwtUserSessionManagerOptions.signOptions.expiresIn},
	 * 							in order to invalidate all issued before access tokens.
	 *
	 * @emits {@link JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED}	No matter whether 0 or multiple sessions are invalidated. If you use multiple {@link JwtUserSessionManager} instances, you are strongly advised to call {@link JwtUserSessionManager.restrictAll} on other instances when this event is emitted.
	 *
	 * @returns		Number of the deleted sessions.
	 */
	public async deleteAll(subject: Subject, jwtPayload?: IssuedJwtPayload): Promise<number> {
		const invalidateSessionsNo = await this.invalidationStrategy.invalidateAllSessions(subject);

		// we do it no matter if sessions were invalidated or no (i.e. it might return 0),
		// in order to support scenario when access token was issued before refresh token was about to expire,
		// then refresh token expired, and when we try to delete all it will return 0,
		// but that access token might still be used, therefore we have to call invalidate access tokens from all sessions

		const accessTokenTtl = jwtPayload ? jwtPayload.exp - jwtPayload.iat : (this.config.signOptions.expiresIn as number);
		this.invalidationStrategy.invalidateAccessTokensFromAllSessions(subject, accessTokenTtl);

		// if we invalidated our access tokens, others need to do the same
		this.emit(JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, subject, accessTokenTtl);

		return invalidateSessionsNo;
	}

	/**
	 * Restricts access to user session from the access token having `jwtPayload`. <br/>
	 * **Notice** that user session won't be deleted, it can be accessed with other access tokens. <br/>
	 *
	 * @example
	 * This method is useful if your NodeJS app operates in cluster mode.
	 * One of the nodes receives delete session request, deletes session from shared DB,
	 * invalidates access tokens for that session on his local cache,
	 * and then notifies other nodes via some sort of EventBus.
	 * Other notes upon receiving notification, will restrict access to deleted user session
	 * (i.e. they will update their local caches with invalidated access tokens).
	 *
	 * @param jwtPayload	Access token to be invalidated.
	 */
	public restrictOne(jwtPayload: IssuedJwtPayload): void {
		this.invalidationStrategy.invalidateAccessToken(jwtPayload);
	}

	/**
	 * Restricts access to all user sessions from all the access tokens issued before. <br/>
	 * **Notice** that user sessions won't be deleted, they can be accessed with access tokens
	 * that can be obtained later with the refresh tokens of these sessions. <br/>
	 *
	 * @example
	 * This method is useful if your NodeJS app operates in cluster mode.
	 * One of the nodes receives delete all sessions request, deletes sessions from shared DB,
	 * invalidates all access tokens from all sessions on his local cache,
	 * and then notifies other nodes via some sort of EventBus.
	 * Other notes upon receiving notification, will restrict access to deleted user sessions
	 * (i.e. they will update their local caches with invalidated access tokens).
	 *
	 * @param subject			Subject.
	 * @param accessTokenTtl	Ttl of the access token.
	 */
	public restrictAll(subject: Subject, accessTokenTtl: Seconds): void {
		this.invalidationStrategy.invalidateAccessTokensFromAllSessions(subject, accessTokenTtl);
	}

	public on(event: JwtUserSessionManagerEvent.SESSION_INVALIDATED, listener: (jwtAccessToken: IssuedJwtPayload) => void): this;

	public on(event: JwtUserSessionManagerEvent.ALL_SESSIONS_INVALIDATED, listener: (subject: string, accessTokenTtl: Seconds) => void): this;

	public on(event: string, listener: (...args: any[]) => void): this {
		super.on(event, listener);
		return this;
	}

	private getSecret(keyType: 'public' | 'private'): string | Buffer {
		if (typeof this.config.secret === 'string' || this.config.secret instanceof Buffer) {
			return this.config.secret;
		}

		return this.config.secret[keyType];
	}

	private async issueJWT(payload: JwtPayload, anchorToRefreshToken: string, signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>): Promise<string> {
		// add some meta-data
		(payload as MutableSome<SignableJwtPayload, 'anc'>).anc = anchorToRefreshToken;

		const secret = this.getSecret('private');

		return new Promise<string>((resolve, reject) =>
			sign(payload, secret, signOptions, (signErr, encoded) => {
				if (signErr) {
					return reject(signErr);
				}
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				return resolve(encoded!);
			})
		);
	}

	private static fillWithDefaults<D extends DeviceBase, L>(options: JwtUserSessionManagerOptions<D, L>): JwtUserSessionManagerOptions<D, L> {
		// mutate payload directly and avoid unnecessary object creations
		(options.signOptions as unknown as SignOptions).mutatePayload = true;
		if (typeof options.signOptions.expiresIn !== 'number') {
			throw createException(
				ErrorCodes.NOT_ALLOWED,
				`Expiration from sign options can't have a type different than number. Given value: ${options.signOptions.expiresIn}`
			);
		}

		return options as JwtUserSessionManagerOptions<D, L>;
	}
}

export { JwtUserSessionManager, JwtUserSessionManagerOptions, JwtUserSessionManagerEvent, JwtSignOptions, JwtVerifyOptions, SessionTokens };
