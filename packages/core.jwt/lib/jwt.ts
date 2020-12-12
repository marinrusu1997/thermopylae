import { VerifyOptions, SignOptions, sign, verify } from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { PublicPrivateKeys, SessionTokens, PromiseResolve, PromiseReject } from '@thermopylae/core.declarations';
import { IssuedJwtPayload, JwtPayload } from './declarations';
import { AbstractInvalidationStrategy, JwtAccessToken } from './invalidation/abstract-invalidation-strategy';
import { createException, ErrorCodes } from './error';
import { SubjectRoleEncoderDecoder } from './utils';

type OnAudienceResolved = (error: Error | null, audience: string | Array<string>) => void;

type AudienceResolver = (subject: string, done: OnAudienceResolved) => void;

interface JwtManagerOptions {
	readonly secret: string | Buffer | PublicPrivateKeys;
	readonly signOptions?: SignOptions;
	readonly verifyOptions?: VerifyOptions;
	readonly invalidationStrategy?: AbstractInvalidationStrategy;
	readonly resolveAudience?: AudienceResolver;
}

const enum JwtManagerEvents {
	SESSION_INVALIDATED = 'session_invalidated',
	ALL_SESSIONS_INVALIDATED = 'all_sessions_invalidated'
}

declare type JwtManagerEventListener = (jwtAccessToken: JwtAccessToken) => void;

class JwtSessionManager extends EventEmitter {
	private readonly secret: string | Buffer | PublicPrivateKeys;

	private readonly signOptions?: SignOptions;

	private readonly verifyOptions?: VerifyOptions;

	private readonly invalidationStrategy?: AbstractInvalidationStrategy;

	private readonly resolveAudience?: AudienceResolver;

	constructor(options: JwtManagerOptions) {
		super();

		this.secret = options.secret;
		this.signOptions = options.signOptions;
		this.verifyOptions = options.verifyOptions;
		this.invalidationStrategy = options.invalidationStrategy;
		this.resolveAudience = options.resolveAudience;
	}

	public createSession(payload: JwtPayload, signOptions?: SignOptions): Promise<SessionTokens> {
		signOptions = { ...this.signOptions, ...signOptions };
		signOptions.mutatePayload = true;

		const secret = this.getSecret('private');

		return new Promise<SessionTokens>((resolve, reject) => {
			if (!signOptions!.audience && this.resolveAudience) {
				return this.resolveAudience(signOptions!.subject!, (resolveAudienceErr, audience) => {
					if (resolveAudienceErr) {
						return reject(resolveAudienceErr);
					}

					signOptions!.audience = audience;

					return this.doSign(payload, secret, signOptions!, resolve, reject);
				});
			}

			return this.doSign(payload, secret, signOptions!, resolve, reject);
		});
	}

	public validateSession(jwtAccessTokenString: string, verifyOptions?: VerifyOptions): Promise<IssuedJwtPayload> {
		verifyOptions = { ...this.verifyOptions, ...verifyOptions };
		const secret = this.getSecret('public');

		return new Promise<IssuedJwtPayload>((resolve, reject) => {
			verify(jwtAccessTokenString, secret, verifyOptions, (verifyError, decoded) => {
				if (verifyError) {
					return reject(verifyError);
				}

				if (!this.invalidationStrategy) {
					return resolve(decoded as IssuedJwtPayload);
				}

				const [sub, role] = SubjectRoleEncoderDecoder.decode((decoded as IssuedJwtPayload).sub);

				const jwtAccessToken: JwtAccessToken = {
					sub,
					iat: (decoded as IssuedJwtPayload).iat,
					role,
					anc: (decoded as IssuedJwtPayload).anc
				};

				return this.invalidationStrategy.isAccessTokenStillValid(jwtAccessToken, (isValidErr, isValid) => {
					if (isValidErr) {
						return reject(isValidErr);
					}

					if (!isValid) {
						return reject(createException(ErrorCodes.INVALID_JWT_ACCESS_TOKEN, 'Token was forcibly invalidated.', decoded));
					}

					return resolve(decoded as IssuedJwtPayload);
				});
			});
		});
	}

	public invalidateSession(jwtAccessTokenPayload: IssuedJwtPayload): Promise<void> {
		if (!this.invalidationStrategy) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) =>
			this.invalidationStrategy!.invalidateSession(jwtAccessTokenPayload, invalidateSessionErr => {
				if (invalidateSessionErr) {
					return reject(invalidateSessionErr);
				}

				this.emit(JwtManagerEvents.SESSION_INVALIDATED, jwtAccessTokenPayload);

				return resolve();
			})
		);
	}

	public invalidateAllSessions(jwtAccessTokenPayload: IssuedJwtPayload): Promise<void> {
		if (!this.invalidationStrategy) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) =>
			this.invalidationStrategy!.invalidateAllSessions(jwtAccessTokenPayload, invalidateAllSessionsErr => {
				if (invalidateAllSessionsErr) {
					return reject(invalidateAllSessionsErr);
				}

				this.emit(JwtManagerEvents.ALL_SESSIONS_INVALIDATED, jwtAccessTokenPayload);

				return resolve();
			})
		);
	}

	public on(event: JwtManagerEvents, listener: JwtManagerEventListener): this {
		super.on(event, listener);

		return this;
	}

	private getSecret(keyType: 'public' | 'private'): string | Buffer {
		if (typeof this.secret === 'string' || this.secret instanceof Buffer) {
			return this.secret;
		}

		return this.secret[keyType];
	}

	private doSign(
		payload: JwtPayload,
		secret: string | Buffer,
		signOptions: SignOptions,
		resolve: PromiseResolve<SessionTokens>,
		reject: PromiseReject
	): void {
		const signCallback = (signErr: Error | null, encoded: string | undefined) => {
			if (signErr) {
				return reject(signErr);
			}
			return resolve({ accessToken: encoded!, refreshToken });
		};

		let refreshToken: string | undefined;

		if (payload.role) {
			payload.sub = SubjectRoleEncoderDecoder.encode(payload.sub, payload.role);
			delete payload.role;
		}

		if (this.invalidationStrategy) {
			return this.invalidationStrategy.generateRefreshToken((generateRefreshTokenErr, anchorableRefreshToken) => {
				if (generateRefreshTokenErr) {
					return reject(generateRefreshTokenErr);
				}

				if (anchorableRefreshToken) {
					refreshToken = anchorableRefreshToken.refreshToken;
					payload.anc = anchorableRefreshToken.anchor;
				}

				return sign(payload, secret, signOptions, signCallback);
			});
		}

		return sign(payload, secret, signOptions, signCallback);
	}
}

export { JwtSessionManager };
