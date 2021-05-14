import { UserSessionManager } from '@thermopylae/lib.user-session';
import type { UserSessionManagerOptions } from '@thermopylae/lib.user-session';
import type {
	Seconds,
	HttpResponseHeader,
	HttpRequestHeader,
	HttpHeaderValue,
	HTTPRequestLocation,
	RequireSome,
	MutableSome
} from '@thermopylae/core.declarations';
import type { UserSessionDevice, AuthorizationTokenExtractor } from '@thermopylae/core.user-session.commons';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { UserSessionUtils } from '@thermopylae/core.user-session.commons';
import { createException } from './error';

// @fixme add brute fore policy, also for jwt-session
// @fixme to prevent brute forcing create long enough session id's https://security.stackexchange.com/questions/81519/session-hijacking-through-sessionid-brute-forcing-possible

interface UserSessionCookiesOptions {
	/**
	 * Lowercase name of the cookie where session id will be stored. <br/>
	 * Notice that this name should be unpredictable one (e.g. not 'sid', 'id' etc). <br/>
	 * Also, cookie name should not begin with *__Host-* or *__Secure-* prefixes, as they will be added automatically.
	 */
	name: string;
	/**
	 * [Secure](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies) attribute. <br/>
	 * **Recommended** value is *true*.
	 */
	readonly secure: boolean;
	/**
	 * Cookie and session ttl.
	 */
	readonly maxAge: Seconds;
	/**
	 * [HttpOnly](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies) attribute. <br/>
	 * **Recommended** value is *true*.
	 */
	readonly httpOnly: boolean;
	/**
	 * [Domain](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_where_cookies_are_sent) attribute. <br/>
	 * **Recommended** value is to be left *undefined*.
	 */
	readonly domain?: string;
	/**
	 * [Path](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_where_cookies_are_sent) attribute. <br/>
	 */
	readonly path: string;
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
	 * **Defaults** to extractor which expects *Authorization* header with value in the format: `Bearer ${token}`.
	 */
	readonly sessionIdExtractor?: AuthorizationTokenExtractor;
}

/**
 * Independently of the cache policy defined by the web application,
 * if caching web application contents is allowed, the session IDs must never be cached,
 * so it is highly recommended to use the **Cache-Control: no-cache="Set-Cookie, Set-Cookie2"** directive,
 * to allow web clients to cache everything except the session ID.
 */

class CookieUserSessionMiddleware {
	private readonly options: RequireSome<CookieUserSessionMiddlewareOptions, 'sessionIdExtractor'>;

	private readonly sessionManager: UserSessionManager<UserSessionDevice, HTTPRequestLocation>;

	public constructor(options: CookieUserSessionMiddlewareOptions) {
		this.options = CookieUserSessionMiddleware.fillWithDefaults(options);
		this.sessionManager = new UserSessionManager<UserSessionDevice, HTTPRequestLocation>(this.options.sessionManager);
	}

	/**
	 * Get {@link UserSessionManager} instance.
	 */
	public get userSessionManager(): UserSessionManager<UserSessionDevice, HTTPRequestLocation> {
		return this.sessionManager;
	}

	public static fillWithDefaults(options: CookieUserSessionMiddlewareOptions): RequireSome<CookieUserSessionMiddlewareOptions, 'sessionIdExtractor'> {
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

		if (options.session.cookie.secure) {
			if (options.session.cookie.domain == null && options.session.cookie.path === '/') {
				options.session.cookie.name = `__Host-${options.session.cookie.name}`;
			} else {
				options.session.cookie.name = `__Secure-${options.session.cookie.name}`;
			}
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
