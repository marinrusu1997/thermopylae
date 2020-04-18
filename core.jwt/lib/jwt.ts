import { VerifyOptions, SignOptions, sign, verify } from 'jsonwebtoken';
import { object } from '@thermopylae/lib.utils';
import { AudienceResolver, IssuedJwtPayload, JwtManagerOptions, JwtPayload, PublicPrivateKeys, SessionTokens } from './declarations';
import { AbstractInvalidationStrategy } from './invalidation/abstract-invalidation-strategy';
import { createException, ErrorCodes } from './error';

class JwtSessionManager {
	private readonly secret: string | Buffer | PublicPrivateKeys;

	private readonly signOptions?: SignOptions;

	private readonly verifyOptions?: VerifyOptions;

	private readonly invalidationStrategy?: AbstractInvalidationStrategy;

	private readonly resolveAudience?: AudienceResolver;

	constructor(options: JwtManagerOptions) {
		this.secret = options.secret;
		this.signOptions = options.signOptions;
		this.verifyOptions = options.verifyOptions;
		this.invalidationStrategy = options.invalidationStrategy;
		this.resolveAudience = options.resolveAudience;
	}

	public createSession(payload: JwtPayload, signOptions?: SignOptions): Promise<SessionTokens> {
		signOptions = { ...this.signOptions, ...signOptions };
		// FIXME resolve audience

		const secret = this.getSecret('private', signOptions);

		return new Promise<SessionTokens>((resolve, reject) => {
			sign(payload, secret, (signErr, encoded) => {
				if (signErr) {
					return reject(signErr);
				}

				if (!this.invalidationStrategy) {
					return resolve({ accessToken: encoded! });
				}

				return this.invalidationStrategy.generateRefreshToken((generateRefreshTokenErr, refreshToken) => {
					if (generateRefreshTokenErr) {
						return reject(generateRefreshTokenErr);
					}

					return resolve({ accessToken: encoded!, refreshToken });
				});
			});
		});
	}

	public validateSession(jwtAccessToken: string, verifyOptions?: VerifyOptions): Promise<IssuedJwtPayload> {
		verifyOptions = { ...this.verifyOptions, ...verifyOptions };
		const secret = this.getSecret('public', verifyOptions);

		return new Promise<IssuedJwtPayload>((resolve, reject) => {
			verify(jwtAccessToken, secret, verifyOptions, (verifyError, decoded) => {
				if (verifyError) {
					return reject(verifyError);
				}

				if (!this.invalidationStrategy) {
					return resolve(decoded as IssuedJwtPayload);
				}

				return this.invalidationStrategy.isAccessTokenStillValid(decoded as IssuedJwtPayload, (isValidErr, isValid) => {
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

	private getSecret(keyType: 'public' | 'private', options: SignOptions | VerifyOptions): string | Buffer {
		if (typeof this.secret === 'string' || this.secret instanceof Buffer) {
			return this.secret;
		}

		if (object.isEmpty(options)) {
			throw createException(ErrorCodes.NO_OPTIONS, `Options are required when using ${keyType} RSA/ECDSA key. `);
		}

		return this.secret[keyType];
	}
}

export { JwtSessionManager };
