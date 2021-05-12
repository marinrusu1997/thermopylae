import { CookieSessionManager } from '@thermopylae/lib.cookie-session';
import { createException } from '@thermopylae/lib.user-session/lib/error';

// @fixme add brute fore policy, also for jwt-session

interface CookieUserSessionMiddlewareOptions {
	/**
	 * Session id cookie options.
	 */
	readonly cookie: {
		/**
		 * Lowercase name of the cookie where session id will be stored. <br/>
		 * Notice that this name should be unpredictable one (e.g. not 'sid', 'id' etc). <br/>
		 * Also, cookie name should not begin with *__Host-* or *__Secure-* prefixes, as they will be added automatically by this library.
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
	};
}

/**
 * @fixme take into account these ones when creating new session, same applies to core.jwt-user-session,
 * maybe move it in common ancestor package.
 *
 * Independently of the cache policy defined by the web application,
 * if caching web application contents is allowed, the session IDs must never be cached,
 * so it is highly recommended to use the **Cache-Control: no-cache="Set-Cookie, Set-Cookie2"** directive,
 * to allow web clients to cache everything except the session ID.
 */

class CookieUserSessionMiddleware {
	public static fillwithdefaults() {
		if (options.cookie.name.startsWith('__Host-')) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Session cookie name is not allowed to start with '__Host-'. Given: ${options.cookie.name}.`);
		}
		if (options.cookie.name.startsWith('__Secure-')) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Session cookie name is not allowed to start with '__Secure-'. Given: ${options.cookie.name}.`);
		}
		if (!isLowerCase(options.cookie.name)) {
			throw createException(ErrorCodes.INVALID, `Cookie name should be lowercase. Given: ${options.cookie.name}.`);
		}

		if (options.cookie.secure) {
			if (options.cookie.domain == null && options.cookie.path === '/') {
				options.cookie.name = `__Host-${options.cookie.name}`;
			} else {
				options.cookie.name = `__Secure-${options.cookie.name}`;
			}
		}
	}
}

function isLowerCase(str: string): boolean {
	return str.toLowerCase() === str;
}

export { CookieUserSessionMiddleware };
