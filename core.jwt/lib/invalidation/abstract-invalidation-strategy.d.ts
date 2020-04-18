import { IssuedJwtPayload } from '../declarations';

declare type GenerateRefreshTokenCallback = (error: Error | null, token?: string) => void;

declare type IsAccessTokenStillValidCallback = (error: Error | null, valid?: boolean) => void;

declare type InvalidateSessionCallback = (error: Error | null) => void;

declare type InvalidateAllSessionsCallback = (error: Error | null, invalidatedSessionsNo: number) => void;

declare interface AbstractInvalidationStrategy {
	generateRefreshToken(done: GenerateRefreshTokenCallback): void;
	isAccessTokenStillValid(jwtAccessToken: IssuedJwtPayload, done: IsAccessTokenStillValidCallback): void;
	invalidateSession(jwtAccessToken: IssuedJwtPayload, refreshToken: string | null, done: InvalidateSessionCallback): void;
	invalidateAllSessions(jwtAccessToken: IssuedJwtPayload, done: InvalidateAllSessionsCallback): void;
}

export { GenerateRefreshTokenCallback, IsAccessTokenStillValidCallback, InvalidateSessionCallback, InvalidateAllSessionsCallback, AbstractInvalidationStrategy };
