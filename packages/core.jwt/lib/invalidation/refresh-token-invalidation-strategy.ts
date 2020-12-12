import { token, chrono } from '@thermopylae/lib.utils';
import { getDefaultMemCache } from '@thermopylae/lib.memcache';
import { Seconds } from '@thermopylae/core.declarations';
import {
	AbstractInvalidationStrategy,
	GenerateRefreshTokenCallback,
	InvalidateSessionCallback,
	IsAccessTokenStillValidCallback,
	JwtAccessToken
} from './abstract-invalidation-strategy';

// FIXME reference links
//	https://medium.com/@benjamin.botto/secure-access-token-storage-with-single-page-applications-part-1-9536b0021321
//	https://medium.com/@benjamin.botto/secure-access-token-storage-with-single-page-applications-part-2-921fce24e1b5
//	https://security.stackexchange.com/questions/223134/how-to-invalidate-jwt-tokens-without-a-database-lookup-with-each-request-to-the
//	https://medium.com/lightrail/getting-token-authentication-right-in-a-stateless-single-page-application-57d0c6474e3
//	https://medium.com/@ideneal/securing-authentication-in-a-spa-using-jwt-token-the-coolest-way-ab883bc372b6
//	https://markitzeroday.com/x-requested-with/cors/2017/06/29/csrf-mitigation-for-ajax-requests.html
//	https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/#logout_token_invalidation

const { generate, UUID_DEFAULT_LENGTH, TokenGenerationType } = token;

type RefreshTokenTtlProvider = (jwtAccessToken: JwtAccessToken) => Seconds;

class RefreshTokenInvalidationStrategy implements AbstractInvalidationStrategy {
	private static readonly ALL_SESSIONS_WILDCARD = '*';

	private readonly tokenLength: number;

	private readonly anchorLength: number;

	private readonly provideRefreshTokenTtl: RefreshTokenTtlProvider;

	private readonly invalidAnchors = getDefaultMemCache();

	constructor(provideRefreshTokenTtl: RefreshTokenTtlProvider, tokenLength = UUID_DEFAULT_LENGTH, anchorLength = 3) {
		this.tokenLength = tokenLength;
		this.anchorLength = anchorLength;
		this.provideRefreshTokenTtl = provideRefreshTokenTtl;
	}

	public generateRefreshToken(done: GenerateRefreshTokenCallback): void {
		try {
			const refreshToken = generate(TokenGenerationType.CRYPTOGRAPHYCAL, this.tokenLength);
			const anchor = refreshToken.slice(0, this.anchorLength);

			done(null, { refreshToken, anchor });
		} catch (generateTokenErr) {
			done(generateTokenErr);
		}
	}

	public isAccessTokenStillValid(jwtAccessToken: JwtAccessToken, done: IsAccessTokenStillValidCallback): void {
		try {
			const isInvalid = this.invalidAnchors.has(`${jwtAccessToken.sub}@${jwtAccessToken.anc}`);
			if (isInvalid) {
				return done(null, false);
			}

			const invalidateAllSessionsTimestamp = this.invalidAnchors.get(`${jwtAccessToken.sub}@${RefreshTokenInvalidationStrategy.ALL_SESSIONS_WILDCARD}`);
			if (typeof invalidateAllSessionsTimestamp === 'number' && jwtAccessToken.iat <= invalidateAllSessionsTimestamp) {
				return done(null, false);
			}

			return done(null, true);
		} catch (checkIsValidError) {
			return done(checkIsValidError);
		}
	}

	public invalidateSession(jwtAccessToken: JwtAccessToken, done: InvalidateSessionCallback): void {
		this.doInvalidateSession(jwtAccessToken, jwtAccessToken.anc!, done);
	}

	public invalidateAllSessions(jwtAccessToken: JwtAccessToken, done: InvalidateSessionCallback): void {
		this.doInvalidateSession(jwtAccessToken, RefreshTokenInvalidationStrategy.ALL_SESSIONS_WILDCARD, done);
	}

	private doInvalidateSession(jwtAccessToken: JwtAccessToken, keySuffix: string, done: InvalidateSessionCallback): void {
		try {
			const refreshTokenTtl = this.provideRefreshTokenTtl(jwtAccessToken);
			const key = `${jwtAccessToken.sub}@${keySuffix}`;
			const value = chrono.dateToUNIX();

			this.invalidAnchors.upset(key, value, refreshTokenTtl);

			done(null);
		} catch (invalidateSessionErr) {
			done(invalidateSessionErr);
		}
	}
}

export { RefreshTokenInvalidationStrategy, RefreshTokenTtlProvider };
