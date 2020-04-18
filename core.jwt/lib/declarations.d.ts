import { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { AbstractInvalidationStrategy } from './invalidation/abstract-invalidation-strategy';

declare interface JwtPayload {
	readonly sub: string;
	readonly aud?: string;
	readonly iss?: string;
	readonly nbf?: string | number;
	readonly [x: string]: any;
}

declare interface IssuedJwtPayload extends JwtPayload {
	readonly iat: number;
	readonly exp: number;
}

declare interface PublicPrivateKeys {
	readonly private: string | Buffer;
	readonly public: string | Buffer;
}

declare type AudienceResolver = (subject: string, role?: string) => Promise<string>;

declare interface JwtManagerOptions {
	readonly secret: string | Buffer | PublicPrivateKeys;
	readonly signOptions?: SignOptions;
	readonly verifyOptions?: VerifyOptions;
	readonly invalidationStrategy?: AbstractInvalidationStrategy;
	readonly resolveAudience?: AudienceResolver;
}

declare interface SessionTokens {
	readonly accessToken: string;
	readonly refreshToken?: string;
}

export { JwtPayload, IssuedJwtPayload, PublicPrivateKeys, AudienceResolver, JwtManagerOptions, SessionTokens };
