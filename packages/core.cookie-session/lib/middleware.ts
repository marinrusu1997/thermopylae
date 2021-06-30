import type {
	HttpResponseHeader,
	HttpRequestHeader,
	HttpHeaderValue,
	HTTPRequestLocation,
	HttpRequest,
	HttpResponse,
	Seconds,
	RequireSome,
	MutableSome,
	Undefinable
} from '@thermopylae/core.declarations';
import type { SessionId, Subject } from '@thermopylae/lib.user-session.commons';
import type { UserSessionManagerOptions, UserSessionMetaData } from '@thermopylae/lib.user-session';
import type { UserSessionDevice, AuthorizationTokenExtractor } from '@thermopylae/core.user-session.commons';
import type { CookieSerializeOptions } from 'cookie';
import { UserSessionManager } from '@thermopylae/lib.user-session';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { UserSessionUtils } from '@thermopylae/core.user-session.commons';
import { Exception } from '@thermopylae/lib.exception';
import { serialize } from 'cookie';
import { ClientType } from '@thermopylae/core.declarations/lib';
import { createException } from './error';

interface UserSessionCookiesOptions {
	/**
	 * Lowercase name of the cookie where session id will be stored. <br/>
	 * Notice that this name should be unpredictable one (e.g. not 'sid', 'id' etc). <br/>
	 * Also, cookie name should not begin with *__Host-* or *__Secure-* prefixes, as they will be added automatically.
	 */
	name: string;
	/**
	 * [Domain](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_where_cookies_are_sent) attribute. <br/>
	 * **Recommended** value is to be left *undefined*.
	 */
	readonly domain?: string;
	/**
	 * [Path](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_where_cookies_are_sent) attribute. <br/>
	 */
	readonly path?: string;
	/**
	 * [SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite) attribute. <br/>
	 * Set value to *false* if you don't want to set this attribute.
	 * **Recommended** value is *strict*.
	 */
	readonly sameSite: 'lax' | 'strict' | 'none' | boolean;
	/**
	 * Whether session id cookie need to be [persisted in browser](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_the_lifetime_of_a_cookie). <br/>
	 * When set to: <br/>
	 * 	- *true* - sets *Max-Age* attribute which makes the browser to persist that cookie for specified amount of time <br/>
	 * 	- *false* - doesn't set *Max-Age*, nor *Expires* attribute which makes the browser to not persist that cookie
	 */
	readonly persistent: boolean;
}

interface UserSessionOptions {
	/**
	 * Session id cookie options.
	 */
	readonly cookie: UserSessionCookiesOptions;
	/**
	 * Lowercase name of header in the HTTP response which will contain session id. <br/>
	 * This option is related to non-browser devices, which will receive session id via header, instead of cookies. <br/>
	 * Decision whether is a browser on non-browser device is taked based on `device` property from the HTTP request object.
	 *
	 * **Notice** that on further subsequent requests, session id will need to be included in the *Authorization* header.
	 *
	 * @example <br/> *x-session-id*
	 */
	readonly header: HttpResponseHeader | string;
	/**
	 * CSRF header options applied only when requests are made from browser devices. <br/>
	 * After session creation, all subsequent requests will need to include {@link UserSessionOptions.csrf.name} header with value
	 * {@link UserSessionOptions.csrf.value}. <br/>
	 * This is needed for [CSRF mitigation](https://markitzeroday.com/x-requested-with/cors/2017/06/29/csrf-mitigation-for-ajax-requests.html).
	 */
	readonly csrf: {
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
	 * (i.e. {@link CookieUserSessionMiddleware.create} and {@link CookieUserSessionMiddleware.renew} operations).
	 */
	readonly 'cache-control': boolean;
}

interface CookieUserSessionMiddlewareOptions {
	/**
	 * Options for {@link UserSessionManager}.
	 */
	readonly sessionManager: UserSessionManagerOptions<UserSessionDevice, HTTPRequestLocation>;
	/**
	 * User session options.
	 */
	readonly session: UserSessionOptions;
	/**
	 * Function which extracts session id from *Authorization* header. <br/>
	 * If the token could not be extracted, the extractor should throw an exception. <br/>
	 * **Defaults** to extractor which expects *Authorization* header with value in the format: `Bearer ${token}`.
	 */
	readonly sessionIdExtractor?: AuthorizationTokenExtractor;
}

/**
 * Cookie User Session middleware which uses *lib.user-session* for session management and HTTP protocol as transport of session id. <br/>
 * Notice that all function members that operate on HTTP response, will set/unset only it's headers,
 * while other parts, like status code, payload etc are left untouched.
 * Also it doesn't send response back to clients, this is the caller job to call `send` on response. <br/>
 * Caller should also handle all of the exceptions (own and of other libraries) thrown by the methods of this class.
 */
class CookieUserSessionMiddleware {
	private readonly options: RequireSome<CookieUserSessionMiddlewareOptions, 'sessionIdExtractor'>;

	private readonly sessionManager: UserSessionManager<UserSessionDevice, HTTPRequestLocation>;

	private readonly cookieSerializeOptions: CookieSerializeOptions;

	private readonly invalidateSessionCookieHeaderValue: string;

	public constructor(options: CookieUserSessionMiddlewareOptions) {
		this.options = CookieUserSessionMiddleware.fillWithDefaults(options);
		this.sessionManager = new UserSessionManager<UserSessionDevice, HTTPRequestLocation>(this.options.sessionManager);

		const cookieSerializeOptions: CookieSerializeOptions = {
			secure: true,
			httpOnly: true,
			sameSite: this.options.session.cookie.sameSite,
			path: this.options.session.cookie.path,
			domain: this.options.session.cookie.domain,
			maxAge: undefined,
			expires: undefined
		};

		// see https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side
		cookieSerializeOptions.expires = new Date('Thu, 01 Jan 1970 00:00:00 GMT');
		this.invalidateSessionCookieHeaderValue = serialize(this.options.session.cookie.name, '', cookieSerializeOptions);

		delete cookieSerializeOptions.expires;
		this.cookieSerializeOptions = Object.seal(cookieSerializeOptions);
	}

	/**
	 * Get {@link UserSessionManager} instance.
	 */
	public get userSessionManager(): UserSessionManager<UserSessionDevice, HTTPRequestLocation> {
		return this.sessionManager;
	}

	/**
	 * Create user session. <br/>
	 * After session creation, sets session id in the response
	 * cookies and/or headers, depending on the device from where request was sent.
	 *
	 * @param req			Incoming HTTP request.
	 * @param res			Outgoing HTTP response.
	 * @param subject		Subject.
	 * @param sessionTtl	Explicit session ttl, has priority over default one.
	 */
	public async create(req: HttpRequest, res: HttpResponse, subject: Subject, sessionTtl?: Seconds): Promise<void> {
		const context = UserSessionUtils.buildUserSessionContext(req);
		const sessionId = await this.sessionManager.create(subject, context, sessionTtl);

		try {
			this.setSessionIdInResponseHeader(req.device && req.device.client && req.device.client.type, res, sessionId, sessionTtl);
		} catch (e) {
			// ensure session is not left dangling
			await this.sessionManager.delete(subject, sessionId);
			throw e;
		}
	}

	/**
	 * Verify user session. <br/>
	 * Session id will be extracted from request according to {@link UserSessionOptions}. <br/>
	 * Depending on the {@link UserSessionManager} config, user session might be renewed, and the new user session id
	 * will be set in the headers of response object. Therefore, it's very important that response is sent to client
	 * with renewed session id at least.
	 *
	 * @param req						Incoming HTTP request.
	 * @param res						Outgoing HTTP response.
	 * @param subject					Subject.
	 * @param unsetSessionCookie		Whether to unset session cookie in the `res` in case it is not found/expired. <br/>
	 * 									This is valid only for requests made from browser devices. <br/>
	 * 									More information about cookie invalidation can be found [here](https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side).
	 */
	public async verify(
		req: HttpRequest,
		res: HttpResponse,
		subject: Subject,
		unsetSessionCookie = true
	): Promise<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>> {
		// outside of try-catch, cuz it throws if not found, or csrf validation issues
		const [sessionId, clientType] = this.extractSessionId(req);

		try {
			const [metaData, renewedSessionId] = await this.sessionManager.read(subject, sessionId, UserSessionUtils.buildUserSessionContext(req));

			if (renewedSessionId != null) {
				this.setSessionIdInResponseHeader(clientType, res, renewedSessionId, metaData.expiresAt - metaData.createdAt);
			}

			return metaData;
		} catch (e) {
			if (
				unsetSessionCookie &&
				clientType === 'browser' &&
				e instanceof Exception &&
				(e.code === ErrorCodes.NOT_FOUND || e.code === ErrorCodes.EXPIRED)
			) {
				res.header('set-cookie', this.invalidateSessionCookieHeaderValue);
			}
			throw e;
		}
	}

	/**
	 * Renew user session, by deleting the old one and creating a new one.
	 *
	 * @param req				Incoming HTTP request.
	 * @param res				Outgoing HTTP response.
	 * @param subject			Subject.
	 * @param metaData			User session metadata.
	 */
	public async renew(
		req: HttpRequest,
		res: HttpResponse,
		subject: Subject,
		metaData: UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>
	): Promise<void> {
		const [sessionId, clientType] = this.extractSessionId(req);
		const renewedSessionId = await this.sessionManager.renew(subject, sessionId, metaData, UserSessionUtils.buildUserSessionContext(req));

		if (renewedSessionId != null) {
			this.setSessionIdInResponseHeader(clientType, res, renewedSessionId, metaData.expiresAt - metaData.createdAt);
		}
	}

	/**
	 * Delete user session. <br/>
	 * Refresh Token will be extracted from request according to {@link UserSessionOptions}.
	 *
	 * @param req					Incoming HTTP request.
	 * @param res					Outgoing HTTP response.
	 * @param subject				Subject which has the session that needs to be deleted.
	 * @param sessionId				Id of the session to be deleted. <br/>
	 * 								This parameter is optional, and should be mainly by admins to forcefully end user session. <br/>
	 * 								**CAUTION!** When this param is set, you will most probably want to set `unsetSessionCookie`
	 * 								to *false* in order to not invalidate session id cookie of the admin.
	 * @param unsetSessionCookie	Whether to unset session cookie in the `res` after session deletion. <br/>
	 * 								This is valid only for requests made from browser devices. <br/>
	 * 								More information about cookie invalidation can be found [here](https://stackoverflow.com/questions/5285940/correct-way-to-delete-cookies-server-side).
	 */
	public async delete(
		req: HttpRequest,
		res: HttpResponse,
		subject: string,
		sessionId: string | null | undefined = undefined,
		unsetSessionCookie = true
	): Promise<void> {
		let clientType: ClientType | null | undefined;

		if (sessionId == null) {
			[sessionId, clientType] = this.extractSessionId(req);
		}
		await this.sessionManager.delete(subject, sessionId);

		if (unsetSessionCookie && clientType === 'browser') {
			res.header('set-cookie', this.invalidateSessionCookieHeaderValue);
		}
	}

	private extractSessionId(req: HttpRequest): [SessionId, ClientType | null] {
		let sessionId: Undefinable<SessionId>;

		if ((sessionId = req.cookie(this.options.session.cookie.name)) == null) {
			return [this.options.sessionIdExtractor(req.header('authorization') as string), null];
		}

		const csrf = req.header(this.options.session.csrf.name);
		if (csrf !== this.options.session.csrf.value) {
			throw createException(ErrorCodes.CHECK_FAILED, `CSRF header value '${csrf}' differs from the expected one.`);
		}

		return [sessionId, 'browser'];
	}

	private setSessionIdInResponseHeader(clientType: ClientType | null | undefined, res: HttpResponse, sessionId: SessionId, sessionTtl?: Seconds): void {
		if (clientType === 'browser') {
			this.cookieSerializeOptions.maxAge = this.options.session.cookie.persistent ? sessionTtl || this.options.sessionManager.sessionTtl : undefined;
			res.header('set-cookie', serialize(this.options.session.cookie.name, sessionId, this.cookieSerializeOptions));

			if (this.options.session['cache-control']) {
				res.header('cache-control', 'no-cache="set-cookie, set-cookie2"');
			}
		} else {
			res.header(this.options.session.header, sessionId);
		}
	}

	private static fillWithDefaults(options: CookieUserSessionMiddlewareOptions): RequireSome<CookieUserSessionMiddlewareOptions, 'sessionIdExtractor'> {
		if (options.session.cookie.name.startsWith('__Host-')) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Session cookie name is not allowed to start with '__Host-'. Given: ${options.session.cookie.name}.`);
		}
		if (options.session.cookie.name.startsWith('__Secure-')) {
			throw createException(
				ErrorCodes.NOT_ALLOWED,
				`Session cookie name is not allowed to start with '__Secure-'. Given: ${options.session.cookie.name}.`
			);
		}
		if (!isLowerCase(options.session.cookie.name)) {
			throw createException(ErrorCodes.INVALID, `Cookie name should be lowercase. Given: ${options.session.cookie.name}.`);
		}

		if (options.session.cookie.domain == null && options.session.cookie.path === '/') {
			options.session.cookie.name = `__Host-${options.session.cookie.name}`;
		} else {
			options.session.cookie.name = `__Secure-${options.session.cookie.name}`;
		}

		if (!isLowerCase(options.session.header)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Session id header name needs to be lower case. Given: ${options.session.header}`);
		}

		if (!isLowerCase(options.session.csrf.name)) {
			throw createException(ErrorCodes.NOT_ALLOWED, `CSRF header name needs to be lower case. Given: ${options.session.csrf.name}`);
		}

		if (options.sessionIdExtractor == null) {
			(options as MutableSome<CookieUserSessionMiddlewareOptions, 'sessionIdExtractor'>).sessionIdExtractor = (authorization) =>
				UserSessionUtils.extractTokenFromAuthorization(authorization, createException);
		}

		return options as RequireSome<CookieUserSessionMiddlewareOptions, 'sessionIdExtractor'>;
	}
}

function isLowerCase(str: string): boolean {
	return str.toLowerCase() === str;
}

export { CookieUserSessionMiddleware };
export type { UserSessionCookiesOptions, UserSessionOptions, CookieUserSessionMiddlewareOptions };
