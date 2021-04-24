import { VerifyOptions, SignOptions, sign, verify } from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { PublicPrivateKeys, ErrorCodes, RequireSome } from '@thermopylae/core.declarations';
import { AllowedEndpointsByJWT, IssuedJwtPayload, JwtPayload } from './declarations';
import { createException } from './error';
import { InvalidationStrategy, InvalidationStrategyOptions } from './invalidation-strategy';

/**
 * Payload of the JWT that will be actually signed.
 */
interface SignableJwtPayload extends JwtPayload {
	/**
	 * Anchored refresh token.
	 * Represents a sub-part (usually the first 6 letters) of the refresh token.
	 * Anchor is used for invalidation purposes.
	 */
	anc: string;

	/**
	 * Endpoints where this token can be used.
	 */
	endp?: AllowedEndpointsByJWT;
}

/**
 * Signing options for Json Web Token.
 */
type JwtSignOptions = Omit<
	RequireSome<SignOptions, 'algorithm' | 'expiresIn' | 'subject' | 'issuer' | 'audience'>,
	'mutatePayload' | 'noTimestamp' | 'header' | 'encoding'
>;

/**
 * Verifying options for Json Web Token
 */
type JwtVerifyOptions = Omit<RequireSome<VerifyOptions, 'algorithms' | 'audience' | 'issuer'>, 'complete' | 'ignoreExpiration' | 'ignoreNotBefore'>;

/**
 * Function which resolves a set of endpoints where access is allowed with the issued JWT.
 */
type AllowedEndpointsResolver = (subject: string) => Promise<AllowedEndpointsByJWT>;

interface JwtSessionManagerOptions {
	/**
	 * Secret used for JWT signing and verify.
	 */
	readonly secret: string | Buffer | PublicPrivateKeys;
	/**
	 * Options for invalidation strategy.
	 */
	readonly invalidationStrategyOptions: InvalidationStrategyOptions;
	/**
	 * Default sign options.
	 */
	signOptions?: JwtSignOptions;
	/**
	 * Default verify options.
	 */
	verifyOptions?: JwtVerifyOptions;
	/**
	 * Allowed endpoints resolver.
	 */
	resolveAllowedEndpoints?: AllowedEndpointsResolver;
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

	public constructor(options: JwtSessionManagerOptions) {
		super();
		this.config = JwtSessionManager.fillWithDefaults(options);
		this.invalidationStrategy = new InvalidationStrategy(options.invalidationStrategyOptions);
	}

	/**
	 * Create user session.
	 *
	 * @param payload		JWT payload.
	 * @param signOptions	Sign options. Provided properties will override the default ones.
	 *
	 * @returns 	Session access and refresh tokens.
	 */
	public async create(payload: JwtPayload, signOptions?: Readonly<JwtSignOptions>): Promise<SessionTokens> {
		signOptions = signOptions ? { ...this.config.signOptions, ...signOptions } : this.config.signOptions;

		const anchorableRefreshToken = await this.invalidationStrategy.generateRefreshToken(signOptions.subject);
		const accessToken = await this.issueJWT(payload, anchorableRefreshToken.anchor, signOptions);

		return { accessToken, refreshToken: anchorableRefreshToken.token };
	}

	/**
	 * Read JWT payload from access token. <br/>
	 * Token will be validated before being decoded and it's payload extracted.
	 *
	 * @param jwtAccessToken	Access token.
	 * @param verifyOptions		Verify options. Provided properties will override the default ones.
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
	 * Update user access token session.
	 *
	 * @param refreshToken		Refresh token.
	 * @param payload			Payload for the newly access token.
	 * @param signOptions		Sign options. Provided properties will override the default ones.
	 *
	 * @throws {Exception}		When refresh token is not valid or will expire soon.
	 *
	 * @returns		JWT access token.
	 */
	public async update(refreshToken: string, payload: JwtPayload, signOptions?: JwtSignOptions): Promise<string> {
		signOptions = { ...this.config.signOptions, ...signOptions };

		const refreshedSession = await this.invalidationStrategy.refreshAccessSession(signOptions.subject, refreshToken, signOptions.expiresIn as number);
		signOptions.expiresIn = refreshedSession.accessTokenTtl;

		return this.issueJWT(payload, refreshedSession.refreshAnchor, signOptions);
	}

	/**
	 * Delete one user session associated with JWT access token.
	 *
	 * @param jwtPayload		Payload of the access token.
	 * @param refreshToken		Refresh token.
	 *
	 * @emits {@link JwtManagerEvents.SESSION_INVALIDATED}	When session is deleted successfully.
	 */
	public async deleteOne(jwtPayload: IssuedJwtPayload, refreshToken: string): Promise<void> {
		if (await this.invalidationStrategy.invalidateSession(jwtPayload, refreshToken)) {
			this.emit(JwtManagerEvents.SESSION_INVALIDATED, jwtPayload);
		}
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
	public async deleteAll(jwtPayload: IssuedJwtPayload): Promise<number> {
		const invalidateSessionsNo = await this.invalidationStrategy.invalidateAllSessions(jwtPayload);
		this.emit(JwtManagerEvents.ALL_SESSIONS_INVALIDATED, jwtPayload); // at leas one session was invalidated
		return invalidateSessionsNo;
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

	private async issueJWT(payload: JwtPayload, anchorToRefreshToken: string, signOptions: Readonly<JwtSignOptions>): Promise<string> {
		// add some meta-data
		(payload as SignableJwtPayload).anc = anchorToRefreshToken;
		(payload as SignableJwtPayload).endp = await this.config.resolveAllowedEndpoints(signOptions.subject); // @fixme this should be removed

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

	private static fillWithDefaults(options: JwtSessionManagerOptions): Readonly<Required<JwtSessionManagerOptions>> {
		if (options.signOptions == null) {
			// mutate payload directly and avoid unnecessary object creations
			((options.signOptions as unknown) as SignOptions) = { mutatePayload: true };
		}

		if (options.resolveAllowedEndpoints == null) {
			options.resolveAllowedEndpoints = () => Promise.resolve(undefined); // allow unrestricted access to all endpoints
		}

		return options as Readonly<Required<JwtSessionManagerOptions>>;
	}
}

export {
	JwtSessionManager,
	JwtSessionManagerOptions,
	InvalidationStrategyOptions,
	AllowedEndpointsResolver,
	JwtSignOptions,
	JwtVerifyOptions,
	JwtPayload,
	SessionTokens,
	IssuedJwtPayload,
	JwtManagerEvents,
	JwtManagerEventListener
};
