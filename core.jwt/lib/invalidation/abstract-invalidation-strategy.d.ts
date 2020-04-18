declare interface JwtAccessToken {
	sub: string;
	iat: number;
	anc?: string;
	role?: string;
}

declare interface AnchorableRefreshToken {
	refreshToken: string;
	anchor: string;
}

declare type GenerateRefreshTokenCallback = (error: Error | null, anchorableRefreshToken?: AnchorableRefreshToken) => void;

declare type IsAccessTokenStillValidCallback = (error: Error | null, valid?: boolean) => void;

declare type InvalidateSessionCallback = (error: Error | null) => void;

declare interface AbstractInvalidationStrategy {
	generateRefreshToken(done: GenerateRefreshTokenCallback): void;
	isAccessTokenStillValid(jwtAccessToken: JwtAccessToken, done: IsAccessTokenStillValidCallback): void;
	invalidateSession(jwtAccessToken: JwtAccessToken, done: InvalidateSessionCallback): void;
	invalidateAllSessions(jwtAccessToken: JwtAccessToken, done: InvalidateSessionCallback): void;
}

export { GenerateRefreshTokenCallback, IsAccessTokenStillValidCallback, InvalidateSessionCallback, JwtAccessToken, AbstractInvalidationStrategy };
