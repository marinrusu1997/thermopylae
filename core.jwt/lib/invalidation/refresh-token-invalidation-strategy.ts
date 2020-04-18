import { token } from '@thermopylae/lib.utils';
import {
	AbstractInvalidationStrategy,
	GenerateRefreshTokenCallback,
	InvalidateAllSessionsCallback,
	InvalidateSessionCallback,
	IsAccessTokenStillValidCallback,
	JwtAccessToken
} from './abstract-invalidation-strategy';

const { generate, UUID_DEFAULT_LENGTH, TokenGenerationType } = token;

interface RefreshTokenRepository {}

class RefreshTokenInvalidationStrategy implements AbstractInvalidationStrategy {
	private readonly tokenLength: number;

	private readonly anchorLength: number;

	private readonly refreshTokenRepository: RefreshTokenRepository;

	private readonly invalidAnchors

	constructor(refreshTokenRepository: RefreshTokenRepository, tokenLength = UUID_DEFAULT_LENGTH, anchorLength = 7) {
		this.tokenLength = tokenLength;
		this.anchorLength = anchorLength;
		this.refreshTokenRepository = refreshTokenRepository;
	}

	generateRefreshToken(done: GenerateRefreshTokenCallback): void {
		try {
			const refreshToken = generate(TokenGenerationType.CRYPTOGRAPHYCAL, this.tokenLength);
			const anchor = refreshToken.slice(0, this.anchorLength);

			done(null, { refreshToken, anchor });
		} catch (generateTokenErr) {
			done(generateTokenErr);
		}
	}

	isAccessTokenStillValid(jwtAccessToken: JwtAccessToken, done: IsAccessTokenStillValidCallback): void {}

	invalidateAllSessions(jwtAccessToken: JwtAccessToken, done: InvalidateAllSessionsCallback): void {}

	invalidateSession(jwtAccessToken: JwtAccessToken, refreshToken: string | null, done: InvalidateSessionCallback): void {}
}

export { RefreshTokenInvalidationStrategy };
