import { VerifyOptions, SignOptions, sign, verify } from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { PublicPrivateKeys, ErrorCodes, RequireSome, RequireAtLeastOne, MutableSome } from '@thermopylae/core.declarations';
import type { DeepReadonly } from 'utility-types';
import { IssuedJwtPayload, JwtPayload, QueriedUserSessionMetaData, UserSessionOperationContext } from './declarations';
import { createException } from './error';
import { InvalidationStrategy, InvalidationStrategyOptions } from './invalidation';

/**
 * Payload of the JWT that will be actually signed.
 *
 * @internal
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

interface JwtSessionManagerOptions {
	/**
	 * Secret used for JWT signing and verify.
	 */
	readonly secret: string | Buffer | PublicPrivateKeys;
	/**
	 * Options for invalidation strategy. <br/>
	 * **Note!** They should not be modified after,
	 * as this object will be used by invalidation strategy without being cloned.
	 */
	readonly invalidationOptions: InvalidationStrategyOptions;
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

const enum JwtManagerEvents {
	SESSION_INVALIDATED = 'SESSION_INVALIDATED',
	ALL_SESSIONS_INVALIDATED = 'ALL_SESSIONS_INVALIDATED'
}

type JwtManagerEventListener = (jwtAccessToken: IssuedJwtPayload) => void;

/**
 * Class which manages user sessions. User session is represented by Json Web Token.
 */
class JwtSessionManager extends EventEmitter {
	private readonly config: Readonly<Required<JwtSessionManagerOptions>>;

	private readonly invalidationStrategy: InvalidationStrategy;

	/**
	 * @param options		Options object. <br/>
	 * 						It should not be modified after, as it will be used without being cloned.
	 */
	public constructor(options: JwtSessionManagerOptions) {
		super();
		this.config = JwtSessionManager.fillWithDefaults(options);
		this.invalidationStrategy = new InvalidationStrategy(options.invalidationOptions);
	}

	/**
	 * Create user session.
	 *
	 * @param payload		JWT payload. <br/>
	 * 						The object will be modified *in-place*.
	 * @param signOptions	Sign options. <br/>
	 * 						Provided properties will override the default ones.
	 * @param context		User session creation context. <br/>
	 * 						Context won't be cloned, therefore you should not update it after operation finishes.
	 *
	 * @returns 	Session access and refresh tokens.
	 */
	public async create(
		payload: JwtPayload,
		signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>,
		context: DeepReadonly<UserSessionOperationContext>
	): Promise<Readonly<SessionTokens>> {
		signOptions = { ...this.config.signOptions, ...signOptions };

		const anchorableRefreshToken = await this.invalidationStrategy.generateRefreshToken(signOptions.subject, context);
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
	 * @throws {Exception}			When token was invalided.
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

					reject(createException(ErrorCodes.INVALID, 'Token was forcibly invalidated.', decoded));
				} catch (e) {
					reject(e);
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
	 */
	public readAll(subject: string): Promise<Array<DeepReadonly<QueriedUserSessionMetaData>>> {
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
	 *
	 * @returns		JWT access token.
	 */
	public async update(
		refreshToken: string,
		payload: JwtPayload,
		signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>,
		context: DeepReadonly<UserSessionOperationContext>
	): Promise<string> {
		signOptions = { ...this.config.signOptions, ...signOptions };

		const anchorToRefreshToken = await this.invalidationStrategy.refreshAccessSession(signOptions.subject, refreshToken, context);
		return this.issueJWT(payload, anchorToRefreshToken, signOptions);
	}

	/**
	 * Delete one user session associated with JWT access token.
	 *
	 * @param jwtPayload		Payload of the access token.
	 * @param refreshToken		Refresh token.
	 *
	 * @emits {@link JwtManagerEvents.SESSION_INVALIDATED}.
	 */
	public async deleteOne(jwtPayload: Readonly<IssuedJwtPayload>, refreshToken: string): Promise<void> {
		await this.invalidationStrategy.invalidateSession(jwtPayload, refreshToken);
		this.emit(JwtManagerEvents.SESSION_INVALIDATED, jwtPayload);
	}

	/**
	 * Deletes all of the user sessions.
	 *
	 * @param jwtPayload		Payload of the access token. <br/>
	 * 							Access token belongs to session from where invalidation occurs.
	 *
	 * @emits {@link JwtManagerEvents.ALL_SESSIONS_INVALIDATED}
	 *
	 * @returns		Number of the deleted sessions.
	 */
	public async deleteAll(jwtPayload: Readonly<IssuedJwtPayload>): Promise<number> {
		const invalidateSessionsNo = await this.invalidationStrategy.invalidateAllSessions(jwtPayload);
		this.emit(JwtManagerEvents.ALL_SESSIONS_INVALIDATED, jwtPayload); // at leas one session was invalidated
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
	public restrictOne(jwtPayload: Readonly<IssuedJwtPayload>): void {
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
	 * @param jwtPayload	Access token of the session from where restrict operation is performed.
	 */
	public restrictAll(jwtPayload: Readonly<IssuedJwtPayload>): void {
		this.invalidationStrategy.invalidateAccessTokensFromAllSessions(jwtPayload);
	}

	public on(event: JwtManagerEvents, listener: JwtManagerEventListener): this {
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
				return resolve(encoded);
			})
		);
	}

	private static fillWithDefaults(options: JwtSessionManagerOptions): Readonly<JwtSessionManagerOptions> {
		// mutate payload directly and avoid unnecessary object creations
		((options.signOptions as unknown) as SignOptions).mutatePayload = true;
		return options as Readonly<Required<JwtSessionManagerOptions>>;
	}
}

export {
	JwtSessionManager,
	JwtSessionManagerOptions,
	InvalidationStrategyOptions,
	JwtSignOptions,
	JwtVerifyOptions,
	JwtPayload,
	SessionTokens,
	IssuedJwtPayload,
	JwtManagerEvents,
	JwtManagerEventListener
};
