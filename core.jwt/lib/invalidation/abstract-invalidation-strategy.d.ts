declare interface JwtAccessToken {
	sub: string;
	anc?: string;
}

declare interface AnchorableRefreshToken {
	refreshToken: string;
	anchor: string;
}

declare type GenerateRefreshTokenCallback = (error: Error | null, anchorableRefreshToken?: AnchorableRefreshToken) => void;

declare type IsAccessTokenStillValidCallback = (error: Error | null, valid?: boolean) => void;

declare type InvalidateSessionCallback = (error: Error | null) => void;

declare type InvalidateAllSessionsCallback = (error: Error | null, invalidatedSessionsNo: number) => void;

declare interface AbstractInvalidationStrategy {
	generateRefreshToken(done: GenerateRefreshTokenCallback): void;
	isAccessTokenStillValid(jwtAccessToken: JwtAccessToken, done: IsAccessTokenStillValidCallback): void;
	invalidateSession(jwtAccessToken: JwtAccessToken, refreshToken: string | null, done: InvalidateSessionCallback): void;
	invalidateAllSessions(jwtAccessToken: JwtAccessToken, done: InvalidateAllSessionsCallback): void;
}

export {
	GenerateRefreshTokenCallback,
	IsAccessTokenStillValidCallback,
	InvalidateSessionCallback,
	InvalidateAllSessionsCallback,
	JwtAccessToken,
	AbstractInvalidationStrategy
};
