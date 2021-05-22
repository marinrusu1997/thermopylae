import type { JwtPayload, JwtUserSessionManagerOptions, JwtSignOptions, JwtVerifyOptions, IssuedJwtPayload } from '@thermopylae/lib.jwt-user-session';
import { JsonWebTokenError, JwtUserSessionManager, TokenExpiredError } from '@thermopylae/lib.jwt-user-session';
import { UserSessionUtils } from '@thermopylae/core.user-session.commons';
import type { UserSessionDevice, AuthorizationTokenExtractor } from '@thermopylae/core.user-session.commons';
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
	RequireSome
} from '@thermopylae/core.declarations';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';
import { serialize } from 'cookie';
import type { CookieSerializeOptions } from 'cookie';
import { createException } from './error';

interface UserSessionCookiesOptions {
	/**
	 * Cookie names.
	 */
	readonly name: {
		/**
		 * Name of the cookie where JWT signature part is stored. <br/>
		 * Name needs to be un lowercase.
		 */
		readonly signature: string;
		/**
		 * Name of the cookie where JWT header.payload part is stored. <br/>
		 * Name needs to be un lowercase.
		 */
		readonly payload: string;
		/**
		 * Name of the cookie where Refresh Token is stored. <br/>
		 * Name needs to be un lowercase.
		 */
		readonly refresh: string;
	};
	/**
	 * Cookie *Path* attribute value.
	 */
	readonly path: {
		/**
		 * *Path* for {@link UserSessionCookiesOptions.name.payload} and {@link UserSessionCookiesOptions.name.signature} cookies. <br/>
		 * Defaults to *Path* attribute not being set.
		 */
		readonly access?: string;
		/**
		 * *Path* for {@link UserSessionCookiesOptions.name.refresh} cookie. <br/>
		 * Refresh tokens are used for session refresh and delete, therefore it needs to contain a very restrictive path,
		 * which covers only these two operations, in order to minimize token exposure. <br/>
		 *
		 * @example
		 * /session path with *PUT* and *DELETE* verbs.
		 */
		readonly refresh: string;
	};
	/**
	 * [SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite) attribute value
	 * used for all user session cookies.
	 */
	readonly sameSite: true | false | 'lax' | 'strict' | 'none';
	/**
	 * [Domain](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#creating_cookies) attribute value
	 * used for all user session cookies. <br/>
	 * Defaults to *Domain* attribute not being set.
	 */
	readonly domain?: string;
	/**
	 * Whether access token cookie(s) need to be [persisted in browser](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_the_lifetime_of_a_cookie). <br/>
	 * When set to: <br/>
	 * 	- *true* - sets *Max-Age* attribute which makes the browser to persist that cookie for specified amount of time <br/>
	 * 	- *false* - doesn't set *Max-Age*, nor *Expires* attribute which makes the browser to not persist that cookie
	 */
	readonly persistentAccessToken: boolean;
}

interface UserSessionOptions {
	/**
	 * User session cookies options.
	 */
	readonly cookies: UserSessionCookiesOptions;
	/**
	 * HTTP headers used for passing Access & Refresh tokens. <br/>
	 * This option is used for non-browser devices.
	 */
	readonly headers: {
		/**
		 * Lowercase name of header in the HTTP response which will contain Access Token. <br/>
		 * This header name will be used in the following situations: <br/>
		 * 	- when sending Access Token after creating session <br/>
		 * 	- when sending Access Token after renewing session <br/>
		 * 	- when sending JWT `payload` to browser clients which won't send CSRF header, as they usually store `payload` in localStorage.
		 *
		 * **Notice** that on further subsequent requests, not matter of the situations above,
		 * Access Token (or it's payload part) will need to be included in the *Authorization* header.
		 *
		 * @example <br/> *x-access-token*
		 */
		readonly access: HttpResponseHeader | string;
		/**
		 * Lowercase name header in the HTTP response which will contain Refresh Token. <br/>
		 * **Notice** that renew and delete session HTTP requests will need to include
		 * header with this name containing Refresh Token.
		 *
		 * @example <br/> *x-refresh-token*
		 */
		readonly refresh: HttpResponseHeader | string;
	};
	/**
	 * This option kicks in only when requests are made from browser devices. <br/>
	 * Depending on the provided value, the following behaviours will happen:
	 * - *true* - this will cause JWT `header.payload` to be sent via {@link UserSessionCookiesOptions.name.payload} cookie. <br/>
	 * 	After that, all subsequent requests will need to include {@link UserSessionOptions.csrfHeader.name} header with value
	 * 	{@link UserSessionOptions.csrfHeader.value}. <br/>
	 * 	This is needed for [CSRF mitigation](https://markitzeroday.com/x-requested-with/cors/2017/06/29/csrf-mitigation-for-ajax-requests.html). <br/>
	 * - *false* - this will cause JWT `header.payload` to be sent to client via {@link UserSessionOptions.headers.access} header. <br/>
	 * 	After that, all subsequent requests will need to include *Authorization* header with `Bearer ${header.payload}` value.
	 *
	 * **Notice** that on requests made from browsers, JWT signature will always be sent via {@link UserSessionCookiesOptions.name.signature} cookie,
	 * no matter of the value for this option.
	 */
	readonly deliveryOfJwtPayloadViaCookie: boolean;
	/**
	 * CSRF header options. <br/>
	 * CSRF will be validated when {@link UserSessionOptions.deliveryOfJwtPayloadViaCookie} has value *true*
	 * or when refresh token is sent to server.
	 */
	readonly csrfHeader: {
		/**
		 * Lowercase name of the CSRF header.
		 *
		 * @example <br/> *x-requested-with*
		 */
		readonly name: HttpRequestHeader | string;
		/**
		 * Value of the the CSRF header. <br/>
		 * This value will be used for comparison with the one from HTTP request.
		 * In case they not match, an error is thrown and request will be aborted.
		 *
		 * @example <br/> *XmlHttpRequest*
		 */
		readonly value: HttpHeaderValue | string;
	};
	/**
	 * Whether to set *Cache-Control: no-cache="Set-Cookie, Set-Cookie2"* response header for the
	 * requests that deliver access and refresh tokens to client
	 * (i.e. {@link JwtUserSessionMiddleware.create} and {@link JwtUserSessionMiddleware.renew} operations).
	 */
	readonly 'cache-control': boolean;
}

interface JwtUserSessionMiddlewareOptions {
	/**
	 * Options for {@link JwtUserSessionManager}.
	 */
	readonly jwt: JwtUserSessionManagerOptions<UserSessionDevice, HTTPRequestLocation>;
	/**
	 * User session options.
	 */
	readonly session: UserSessionOptions;
	/**
	 * Function which extracts Access Token from *Authorization* header. <br/>
	 * **Defaults** to extractor which expects *Authorization* header with value in the format: `Bearer ${token}`.
	 */
	readonly accessTokenExtractor?: AuthorizationTokenExtractor;
}

/**
 * JWT User Session middleware which uses *lib.jwt-user-session* for session management and HTTP protocol as transport of user session tokens. <br/>
 * Notice that all function members that operate on HTTP response, will set/unset only it's headers,
 * while other parts, like status code, payload etc are left untouched.
 * Also it doesn't send response back to clients, this is the caller job to call `send` on response. <br/>
 * Implementation is based on the following articles: <br/>
 * 	- [JWT split in two cookies](https://medium.com/lightrail/getting-token-authentication-right-in-a-stateless-single-page-application-57d0c6474e3) <br/>
 * 	- [JWT split in signature cookie and Authorization header](https://medium.com/lightrail/getting-token-authentication-right-in-a-stateless-single-page-application-57d0c6474e3) <br/>
 * 	- [JWT refresh and revoke with Refresh Token](https://hasura.io/blog/best-practices-of-using-jwt-with-graphql/#silent_refresh) <br/>
 * 	- [CSRF mitigation](https://markitzeroday.com/x-requested-with/cors/2017/06/29/csrf-mitigation-for-ajax-requests.html) <br/>
 */
class JwtUserSessionMiddleware {
	private readonly options: RequireSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'>;

	private readonly jwtSessionManager: JwtUserSessionManager<UserSessionDevice, HTTPRequestLocation>;

	private readonly refreshTokenCookieOptions: CookieSerializeOptions;

	private readonly accessTokenCookieOptions: CookieSerializeOptions;

	private readonly invalidationCookies: Readonly<Record<'signature' | 'payload' | 'refresh', string>>;

	public constructor(options: JwtUserSessionMiddlewareOptions) {
		this.options = JwtUserSessionMiddleware.fillWithDefaults(options);
		this.jwtSessionManager = new JwtUserSessionManager<UserSessionDevice, HTTPRequestLocation>(options.jwt);

		this.refreshTokenCookieOptions = Object.freeze({
			path: this.options.session.cookies.path.refresh,
			secure: true,
			httpOnly: true,
			sameSite: this.options.session.cookies.sameSite,
			domain: this.options.session.cookies.domain,
			maxAge: this.options.jwt.invalidationOptions.refreshTokenTtl
		});

		this.accessTokenCookieOptions = Object.seal({
			path: this.options.session.cookies.path.access,
			secure: true,
			httpOnly: true,
			sameSite: this.options.session.cookies.sameSite,
			domain: this.options.session.cookies.domain,
			maxAge: undefined
		});

		// see https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side
		const invalidateCookieOptions: CookieSerializeOptions = {
			expires: new Date('Thu, 01 Jan 1970 00:00:00 GMT')
		};
		this.invalidationCookies = Object.freeze({
			signature: serialize(this.options.session.cookies.name.signature, '', invalidateCookieOptions),
			payload: serialize(this.options.session.cookies.name.payload, '', invalidateCookieOptions),
			refresh: serialize(this.options.session.cookies.name.refresh, '', invalidateCookieOptions)
		});
	}

	/**
	 * Get {@link JwtUserSessionManager} instance.
	 */
	public get sessionManager(): JwtUserSessionManager<UserSessionDevice, HTTPRequestLocation> {
		return this.jwtSessionManager;
	}

	/**
	 * Create user session. <br/>
	 * After session creation, sets Access and Refresh tokens in the response
	 * cookies and/or headers, according to {@link UserSessionOptions}.
	 *
	 * @param req			Incoming HTTP request.
	 * @param res			Outgoing HTTP response.
	 * @param jwtPayload	Payload of the JWT token.
	 * @param signOptions	Sign options. Needs to contain at least subject for whom session is created.
	 */
	public async create(req: HttpRequest, res: HttpResponse, jwtPayload: JwtPayload, signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>): Promise<void> {
		const context = UserSessionUtils.buildUserSessionContext(req);
		const session = await this.jwtSessionManager.create(jwtPayload, signOptions, context);

		try {
			if (req.device && req.device.client && req.device.client.type === 'browser') {
				res.header('set-cookie', serialize(this.options.session.cookies.name.refresh, session.refreshToken, this.refreshTokenCookieOptions));

				this.setAccessTokenInResponseForBrowserWithOptionalCacheControl(session.accessToken, signOptions.expiresIn as number, res);
			} else {
				res.header(this.options.session.headers.access, session.accessToken);
				res.header(this.options.session.headers.refresh, session.refreshToken);
			}
		} catch (e) {
			// ensure session is not left dangling
			const accessTokenPayload = await this.jwtSessionManager.read(session.accessToken);
			await this.jwtSessionManager.deleteOne(accessTokenPayload.sub, session.refreshToken, accessTokenPayload);
			throw e;
		}
	}

	/**
	 * Verify user session. <br/>
	 * Access token will be extracted from request according to {@link UserSessionOptions}.
	 *
	 * @param req						Incoming HTTP request.
	 * @param res						Outgoing HTTP response.
	 * @param verifyOptions				Verify JWT access token options.
	 * @param unsetSessionCookies		Whether to unset session cookies in the `res` in case JWT is expired, malformed or invalidated. <br/>
	 * 									This is valid only for requests made from browser devices. <br/>
	 * 									More information about cookie invalidation can be found [here](https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side).
	 */
	public async verify(req: HttpRequest, res: HttpResponse, verifyOptions?: JwtVerifyOptions, unsetSessionCookies = true): Promise<IssuedJwtPayload> {
		let accessToken: string;

		let payloadCookie: string | undefined;
		const signatureCookie = req.cookie(this.options.session.cookies.name.signature);

		if (signatureCookie == null) {
			accessToken = this.options.accessTokenExtractor(req.header('authorization') as string);
		} else {
			payloadCookie = req.cookie(this.options.session.cookies.name.payload);
			if (payloadCookie != null) {
				this.performCSRFValidation(req);
				accessToken = `${payloadCookie}.${signatureCookie}`;
			} else {
				accessToken = `${this.options.accessTokenExtractor(req.header('authorization') as string)}.${signatureCookie}`;
			}
		}

		try {
			return await this.jwtSessionManager.read(accessToken, verifyOptions);
		} catch (e) {
			if (
				unsetSessionCookies &&
				(e instanceof TokenExpiredError || e instanceof JsonWebTokenError || (e instanceof Exception && e.code === ErrorCodes.INVALID))
			) {
				if (signatureCookie != null) {
					res.header('set-cookie', this.invalidationCookies.signature);
				}
				if (payloadCookie != null) {
					res.header('set-cookie', this.invalidationCookies.payload);
				}
			}
			throw e;
		}
	}

	/**
	 * Refresh Access Token. <br/>
	 * Refresh Token will be extracted from request according to {@link UserSessionOptions}. <br/>
	 * Access Token will be included in response depending on client type and according to {@link UserSessionOptions}.
	 *
	 * @param req				Incoming HTTP request.
	 * @param res				Outgoing HTTP response.
	 * @param jwtPayload		Payload of the refreshed JWT.
	 * @param signOptions		Sign options. Needs to contain at least subject for whom session is created.
	 */
	public async refresh(
		req: HttpRequest,
		res: HttpResponse,
		jwtPayload: JwtPayload,
		signOptions: RequireAtLeastOne<JwtSignOptions, 'subject'>
	): Promise<void> {
		const [refreshToken, clientType] = this.getRefreshTokenFromRequest(req);

		const context = UserSessionUtils.buildUserSessionContext(req);
		const accessToken = await this.jwtSessionManager.update(refreshToken, jwtPayload, signOptions, context);

		if (clientType === 'browser') {
			this.setAccessTokenInResponseForBrowserWithOptionalCacheControl(accessToken, signOptions.expiresIn as number, res);
		} else {
			res.header(this.options.session.headers.access, accessToken);
		}
	}

	/**
	 * Delete user session. <br/>
	 * Refresh Token will be extracted from request according to {@link UserSessionOptions}.
	 *
	 * @param req					Incoming HTTP request.
	 * @param res					Outgoing HTTP response.
	 * @param subject				Subject which has the session that needs to be deleted.
	 * @param payload				JWT Access Token payload. <br/>
	 * 								This parameter is optional and can be omitted when deletion is made by admin who doesn't have access token of the user.
	 * @param unsetSessionCookies	Whether to unset session cookies in the `res` after session deletion. <br/>
	 * 								This is valid only for requests made from browser devices and when `payload` param is provided. <br/>
	 * 								More information about cookie invalidation can be found [here](https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side).
	 */
	public async delete(req: HttpRequest, res: HttpResponse, subject: string, payload?: IssuedJwtPayload, unsetSessionCookies = true): Promise<void> {
		const [refreshToken, clientType] = this.getRefreshTokenFromRequest(req);
		await this.jwtSessionManager.deleteOne(subject, refreshToken, payload);

		if (unsetSessionCookies && clientType === 'browser' && payload) {
			res.header('set-cookie', this.invalidationCookies.refresh);
			res.header('set-cookie', this.invalidationCookies.signature);
			if (this.options.session.deliveryOfJwtPayloadViaCookie) {
				res.header('set-cookie', this.invalidationCookies.payload);
			}
		}
	}

	private getRefreshTokenFromRequest(req: HttpRequest): [string, ClientType | null] {
		let refreshToken: string | undefined;

		if ((refreshToken = req.cookie(this.options.session.cookies.name.refresh))) {
			this.performCSRFValidation(req);
			return [refreshToken, 'browser'];
		}
		if ((refreshToken = req.header(this.options.session.headers.refresh) as string)) {
			return [refreshToken, null];
		}
		throw createException(ErrorCodes.NOT_FOUND, 'Refresh token not found in the request header nor cookies.');
	}

	private performCSRFValidation(req: HttpRequest): void | never {
		const csrf = req.header(this.options.session.csrfHeader.name);
		if (csrf !== this.options.session.csrfHeader.value) {
			throw createException(ErrorCodes.CHECK_FAILED, `CSRF header value '${csrf}' differs from the expected one.`);
		}
	}

	private setAccessTokenInResponseForBrowserWithOptionalCacheControl(token: string, expiresIn: number | undefined, res: HttpResponse): void {
		const [header, payload, signature] = token.split('.');

		// maxAge is common for both
		this.accessTokenCookieOptions.maxAge = this.options.session.cookies.persistentAccessToken
			? typeof expiresIn === 'number'
				? expiresIn
				: (this.options.jwt.signOptions.expiresIn as number)
			: undefined;

		this.accessTokenCookieOptions.httpOnly = true; // only for signature
		const signatureCookie = serialize(this.options.session.cookies.name.signature, signature, this.accessTokenCookieOptions);
		res.header('set-cookie', signatureCookie);

		if (this.options.session.deliveryOfJwtPayloadViaCookie) {
			this.accessTokenCookieOptions.httpOnly = false; // only for payload
			const payloadCookie = serialize(this.options.session.cookies.name.payload, `${header}.${payload}`, this.accessTokenCookieOptions);
			res.header('set-cookie', payloadCookie);
		} else {
			res.header(this.options.session.headers.access, `${header}.${payload}`);
		}

		if (this.options.session['cache-control']) {
			if (this.options.session.deliveryOfJwtPayloadViaCookie) {
				res.header('cache-control', 'no-cache="set-cookie, set-cookie2"');
			} else {
				res.header('cache-control', `no-cache="set-cookie, set-cookie2, ${this.options.session.headers.access}"`);
			}
		}
	}

	private static fillWithDefaults(options: JwtUserSessionMiddlewareOptions): RequireSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'> {
		// it's mandatory for them to be in lower case

		if (!UserSessionUtils.isLowerCase(options.session.cookies.name.signature)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Signature cookie name needs to be lower case. Given: ${options.session.cookies.name.signature}`);
		}
		if (!UserSessionUtils.isLowerCase(options.session.cookies.name.payload)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Payload cookie name needs to be lower case. Given: ${options.session.cookies.name.payload}`);
		}
		if (!UserSessionUtils.isLowerCase(options.session.cookies.name.refresh)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Refresh cookie name needs to be lower case. Given: ${options.session.cookies.name.refresh}`);
		}

		if (!UserSessionUtils.isLowerCase(options.session.headers.access)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Access token header name needs to be lower case. Given: ${options.session.headers.access}`);
		}
		if (!UserSessionUtils.isLowerCase(options.session.headers.refresh)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Refresh token header name needs to be lower case. Given: ${options.session.headers.refresh}`);
		}

		if (options.session.csrfHeader && !UserSessionUtils.isLowerCase(options.session.csrfHeader.name)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `CSRF header name needs to be lower case. Given: ${options.session.csrfHeader.name}`);
		}

		if (options.accessTokenExtractor == null) {
			(options as MutableSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'>).accessTokenExtractor = (authorization) =>
				UserSessionUtils.extractTokenFromAuthorization(authorization, createException);
		}

		return options as RequireSome<JwtUserSessionMiddlewareOptions, 'accessTokenExtractor'>;
	}
}

export { JwtUserSessionMiddleware, JwtUserSessionMiddlewareOptions, UserSessionOptions, UserSessionCookiesOptions };
