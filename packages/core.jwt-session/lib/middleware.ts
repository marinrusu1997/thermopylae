import type {
	JwtPayload,
	JwtSessionManagerOptions,
	JwtSignOptions,
	JwtVerifyOptions,
	UserSessionOperationContext,
	IssuedJwtPayload
} from '@thermopylae/lib.jwt-session';
import { JsonWebTokenError, JwtSessionManager, TokenExpiredError } from '@thermopylae/lib.jwt-session';
import type {
	ClientType,
	HttpHeaderValue,
	HttpRequest,
	HttpRequestHeader,
	HTTPRequestLocation,
	HttpResponse,
	HttpResponseHeader,
	MutableSome,
	RequireAtLeastOne,
	RequireSome,
	Undefinable
} from '@thermopylae/core.declarations';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';
import { CookieSerializeOptions, serialize } from 'cookie';
import type { JwtSessionDevice } from './typings';
import { createException } from './error';

/**
 * Extract access token from *Authorization* header.
 */
type AccessTokenExtractor = (authorization: string | null | undefined) => string;

interface UserSessionCookiesOptions {
	readonly name: {
		readonly signature: string;
		readonly payload: string;
		readonly refresh: string;
	};
	readonly path: {
		readonly access?: string;
		/**
		 * Very restrictive only to refresh operation!!!
		 */
		readonly refresh: string;
	};
	readonly sameSite?: true | false | 'lax' | 'strict' | 'none';
	readonly domain?: string;
	readonly persistent: boolean;
}

interface UserSessionOptions {
	/**
	 *
	 */
	readonly cookies: UserSessionCookiesOptions;
	readonly headers: {
		/**
		 * Lowercase!!! // @fixme test it
		 */
		readonly access: HttpResponseHeader | string;
		/**
		 * Lowercase!!! // @fixme test it
		 */
		readonly refresh: HttpResponseHeader | string;
	};
	/**
	 * Either: https://medium.com/@benjamin.botto/secure-access-token-storage-with-single-page-applications-part-2-921fce24e1b5
	 * Or: https://markitzeroday.com/x-requested-with/cors/2017/06/29/csrf-mitigation-for-ajax-requests.html
	 */
	readonly csrfHeader?: {
		/**
		 * Lowercase!!! // @fixme test it
		 */
		readonly name: HttpRequestHeader | string;
		readonly value: HttpHeaderValue | string;
	};
}

interface JwtUserSessionMiddlewareOptions {
	/**
	 * Options for {@link JwtSessionManager}.
	 */
	readonly jwt: JwtSessionManagerOptions<JwtSessionDevice, HTTPRequestLocation>;
	/**
	 * User session options.
	 */
	readonly session: UserSessionOptions;
	readonly accessTokenExtractor?: AccessTokenExtractor;
}

class JwtUserSessionMiddleware {
	// see https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side
	private static readonly INVALIDATE_COOKIE: CookieSerializeOptions = {
		expires: new Date('Thu, 01 Jan 1970 00:00:00 GMT')
	};

	private readonly options: RequireSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'>;

	private readonly jwtSessionManager: JwtSessionManager<JwtSessionDevice, HTTPRequestLocation>;

	public constructor(options: JwtUserSessionMiddlewareOptions) {
		this.options = JwtUserSessionMiddleware.fillWithDefaults(options);
		this.jwtSessionManager = new JwtSessionManager<JwtSessionDevice, HTTPRequestLocation>(options.jwt);
	}

	public get sessionManager(): JwtSessionManager<JwtSessionDevice, HTTPRequestLocation> {
		return this.jwtSessionManager;
	}

	public async create(req: HttpRequest, res: HttpResponse, jwtPayload: JwtPayload, signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>): Promise<void> {
		const context = JwtUserSessionMiddleware.sessionContext(req);
		const session = await this.jwtSessionManager.create(jwtPayload, signOptions, context);

		try {
			if (req.device && req.device.client && req.device.client.type === 'browser') {
				this.setAccessTokenInResponseForBrowser(session.accessToken, signOptions.expiresIn as number, res);

				const refreshCookie = serialize(this.options.session.cookies.name.refresh, session.refreshToken, {
					path: this.options.session.cookies.path.refresh,
					secure: true,
					httpOnly: true,
					sameSite: this.options.session.cookies.sameSite,
					domain: this.options.session.cookies.domain,
					maxAge: this.options.jwt.invalidationOptions.refreshTokenTtl
				});
				res.header('set-cookie', refreshCookie);
			} else {
				res.header(this.options.session.headers.access, session.accessToken);
				res.header(this.options.session.headers.refresh, session.refreshToken);
			}
		} catch (e) {
			// ensure session is not left dangling
			const accessTokenPayload = await this.jwtSessionManager.read(session.accessToken);
			await this.jwtSessionManager.deleteOne(accessTokenPayload, session.refreshToken);
			throw e;
		}
	}

	public async verify(req: HttpRequest, res: HttpResponse, verifyOptions?: JwtVerifyOptions): Promise<IssuedJwtPayload> {
		let accessToken: string;

		let payloadCookie: string | undefined;
		const signatureCookie = req.cookie(this.options.session.cookies.name.signature);

		if (signatureCookie == null) {
			accessToken = this.options.accessTokenExtractor(req.header('authorization') as string);
		} else {
			payloadCookie = req.cookie(this.options.session.cookies.name.payload);
			if (payloadCookie != null) {
				const csrf = req.header(this.options.session.csrfHeader!.name);
				if (csrf !== this.options.session.csrfHeader!.value) {
					throw createException(ErrorCodes.CHECK_FAILED, `CSRF header value '${csrf}' differs from the expected one.`);
				}

				accessToken = `${payloadCookie}.${signatureCookie}`;
			} else {
				accessToken = `${this.options.accessTokenExtractor(req.header('authorization') as string)}.${signatureCookie}`;
			}
		}

		try {
			return await this.jwtSessionManager.read(accessToken, verifyOptions);
		} catch (e) {
			if (e instanceof TokenExpiredError || e instanceof JsonWebTokenError || (e instanceof Exception && e.code === ErrorCodes.INVALID)) {
				if (signatureCookie != null) {
					res.header('set-cookie', serialize(this.options.session.cookies.name.signature, '', JwtUserSessionMiddleware.INVALIDATE_COOKIE));
				}
				if (payloadCookie != null) {
					res.header('set-cookie', serialize(this.options.session.cookies.name.payload, '', JwtUserSessionMiddleware.INVALIDATE_COOKIE));
				}
			}
			throw e;
		}
	}

	public async refresh(
		req: HttpRequest,
		res: HttpResponse,
		jwtPayload: JwtPayload,
		signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>
	): Promise<void> {
		const [refreshToken, clientType] = this.getRefreshTokenFromRequest(req);

		const context = JwtUserSessionMiddleware.sessionContext(req);
		const accessToken = await this.jwtSessionManager.update(refreshToken, jwtPayload, signOptions, context);

		if (clientType === 'browser') {
			this.setAccessTokenInResponseForBrowser(accessToken, signOptions.expiresIn as number, res);
		} else {
			res.header(this.options.session.headers.access, accessToken);
		}
	}

	public async delete(req: HttpRequest, res: HttpResponse, payload: IssuedJwtPayload): Promise<void> {
		const [refreshToken, clientType] = this.getRefreshTokenFromRequest(req);
		await this.jwtSessionManager.deleteOne(payload, refreshToken);

		if (clientType === 'browser') {
			res.header('set-cookie', serialize(this.options.session.cookies.name.refresh, '', JwtUserSessionMiddleware.INVALIDATE_COOKIE));
			res.header('set-cookie', serialize(this.options.session.cookies.name.signature, '', JwtUserSessionMiddleware.INVALIDATE_COOKIE));
			if (this.options.session.csrfHeader) {
				res.header('set-cookie', serialize(this.options.session.cookies.name.payload, '', JwtUserSessionMiddleware.INVALIDATE_COOKIE));
			}
		}
	}

	private getRefreshTokenFromRequest(req: HttpRequest): [string, ClientType] {
		let refreshToken: string | undefined;

		if ((refreshToken = req.cookie(this.options.session.cookies.name.refresh))) {
			return [refreshToken, 'browser'];
		}
		if ((refreshToken = req.header(this.options.session.headers.refresh) as string)) {
			return [refreshToken, ''];
		}
		throw createException(ErrorCodes.NOT_FOUND, 'Refresh token not found in the request header nor cookies.');
	}

	private setAccessTokenInResponseForBrowser(token: string, expiresIn: number | undefined, res: HttpResponse): void {
		const [header, payload, signature] = token.split('.');
		const accessTokenCookiesMaxAge = this.options.session.cookies.persistent
			? typeof expiresIn === 'number'
				? expiresIn
				: (this.options.jwt.signOptions.expiresIn as number)
			: undefined;

		const signatureCookie = serialize(this.options.session.cookies.name.signature, signature, {
			path: this.options.session.cookies.path.access,
			secure: true,
			httpOnly: true,
			sameSite: this.options.session.cookies.sameSite,
			domain: this.options.session.cookies.domain,
			maxAge: accessTokenCookiesMaxAge
		});
		res.header('set-cookie', signatureCookie);

		if (this.options.session.csrfHeader) {
			const payloadCookie = serialize(this.options.session.cookies.name.payload, `${header}.${payload}`, {
				path: this.options.session.cookies.path.access,
				secure: true,
				httpOnly: false,
				sameSite: this.options.session.cookies.sameSite,
				domain: this.options.session.cookies.domain,
				maxAge: accessTokenCookiesMaxAge
			});
			res.header('set-cookie', payloadCookie);
		} else {
			res.header(this.options.session.headers.access, `${header}.${payload}`);
		}
	}

	private static sessionContext(req: HttpRequest): UserSessionOperationContext<JwtSessionDevice, HTTPRequestLocation> {
		return {
			ip: req.ip,
			device:
				req.device && req.device.device
					? {
							name: `${req.device.device.brand} ${req.device.device.model}`,
							type: req.device.device.type,
							client: req.device.client || undefined,
							os: req.device.os || undefined
					  }
					: undefined,
			location: req.location
		};
	}

	private static extractAccessToken(authorization: string | undefined | null): string {
		if (typeof authorization !== 'string') {
			throw createException(ErrorCodes.NOT_FOUND, `Authorization header value not present.`);
		}

		const [scheme, token] = authorization.split(' ') as [Undefinable<string>, Undefinable<string>];
		if (scheme !== 'Bearer') {
			throw createException(ErrorCodes.UNPROCESSABLE, `Authorization scheme needs to be 'Bearer'. Authorization header value: ${authorization}`);
		}
		if (typeof token !== 'string') {
			throw createException(ErrorCodes.NOT_FOUND, `Can't extract access token. Authorization header value ${authorization}`);
		}
		return token;
	}

	private static fillWithDefaults(options: JwtUserSessionMiddlewareOptions): RequireSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'> {
		if (!isLowerCase(options.session.cookies.name.signature)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Signature cookie name needs to be lower case. Given: ${options.session.cookies.name.signature}`);
		}
		if (!isLowerCase(options.session.cookies.name.payload)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Payload cookie name needs to be lower case. Given: ${options.session.cookies.name.payload}`);
		}
		if (!isLowerCase(options.session.cookies.name.refresh)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Refresh cookie name needs to be lower case. Given: ${options.session.cookies.name.refresh}`);
		}

		if (!isLowerCase(options.session.headers.access)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Access token header name needs to be lower case. Given: ${options.session.headers.access}`);
		}
		if (!isLowerCase(options.session.headers.refresh)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Refresh token header name needs to be lower case. Given: ${options.session.headers.refresh}`);
		}

		if (options.session.csrfHeader && !isLowerCase(options.session.csrfHeader.name)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `CSRF header name needs to be lower case. Given: ${options.session.csrfHeader.name}`);
		}

		if (options.accessTokenExtractor == null) {
			(options as MutableSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'>).accessTokenExtractor =
				JwtUserSessionMiddleware.extractAccessToken;
		}

		return options as RequireSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'>;
	}
}

function isLowerCase(str: string): boolean {
	return str.toLowerCase() === str;
}

export { JwtUserSessionMiddleware, AccessTokenExtractor, JwtUserSessionMiddlewareOptions, UserSessionOptions, UserSessionCookiesOptions };
