import { ErrorCodes } from '@thermopylae/core.declarations';
import type { Seconds, UnixTimestamp, MutableSome } from '@thermopylae/core.declarations';
import type { WinstonLogger } from '@thermopylae/lib.logger';
import type { DeepReadonly, DeepRequired } from 'utility-types';
import { serialize } from 'cookie';
import safeUid from 'uid-safe';
import { createHash } from 'crypto';
import { createException } from './error';
import { CommitType } from './storage';
import type { DeviceBase, SessionId, UserSessionMetaData, UserSessionOperationContext } from './session';
import type { SessionsStorage } from './storage';

/**
 * Hook called on user session read.
 *
 * @param subject			Session id.
 * @param context			Read user session operation context.
 * @param sessionMetaData	Session metadata that was retrieved from storage.
 *
 * @throws 	In case some anomalies are detected between read context and session metadata,
 * 			an exception should be thrown to stop read operation and mark session access as invalid.
 */
type ReadUserSessionHook<Device extends DeviceBase, Location> = (
	sessionId: SessionId,
	context: UserSessionOperationContext<Device, Location>,
	sessionMetaData: Readonly<UserSessionMetaData<Device, Location>>
) => void;

interface CookieSessionManagerOptions<Device extends DeviceBase, Location> {
	/**
	 * Length of the generated session id. <br/>
	 * Because base64 encoding is used underneath, this is not the string length.
	 * For example, to create a token of length 24, you want a byte length of 18. <br/>
	 * Value of this option should not be lower than 15.
	 */
	readonly idLength: number;
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
	/**
	 * User session lifetime timeouts.
	 */
	timeouts?: {
		/**
		 * This timeout defines the amount of time in seconds a session will remain active
		 * in case there is no activity in the session, closing and invalidating the session
		 * upon the defined idle period since the last HTTP request received by the web application. <br/>
		 * If you do not need idle session feature, do not set this option. <br/>
		 * **Defaults** to *undefined*.
		 */
		readonly idle?: Seconds;
		/**
		 * This timeout defines the amount of time in seconds since session creation
		 * after which the session ID is automatically renewed, in the middle of the user session,
		 * and independently of the session activity and, therefore, of the idle timeout. <br/>
		 * Renewal consists in deletion of the old session and creation of a new one. <br/>
		 * If you do not need idle session feature, do not set this option. <br/>
		 * **Defaults** to *undefined*.
		 */
		readonly renewal?: Seconds;
		/**
		 * This timeout defines the amount of time the old session will still be available after it was renewed. <br/>
		 * This timeout starts counting from renew session operation, and on elapse will delete the old session. <br/>
		 * Usually you will want to keep this timeout as small as possible to give a chance to requests that
		 * were issued before renew operation to finish successfully, and then invalidate old session.
		 * If {@link CookieSessionManagerOptions.timeouts.renewal} option is not set, this option is ignored. <br/>
		 * **Required** when {@link CookieSessionManagerOptions.timeouts.renewal} option is set.
		 * **Recommended** value is *5*.
		 */
		readonly oldSessionAvailabilityTimeoutAfterRenewal?: Seconds;
	};
	/**
	 * Storage where users sessions are stored.
	 */
	storage: SessionsStorage<Device, Location>;
	/**
	 * Read user session hook. <br/>
	 * Defaults to hook which ensures that in case device is present in both context and session metadata,
	 * their *name* and *type* needs to be equal.
	 */
	readUserSessionHook?: ReadUserSessionHook<Device, Location>;
	/**
	 * Logger to inform about critical events detected by the library.
	 */
	logger: WinstonLogger;
}

/**
 * Mark session as being renewed.
 */
const RENEWED_SESSION_FLAG = -1;

/**
 * Stateful implementation of the user sessions using cookies as exchange mechanism. <br/>
 * Session data is stored in external storage and client receives only it's id. <br/>
 * Sessions are implemented in a such way, so that they can be used in cluster or single-node infrastructures.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
class CookieSessionManager<Device extends DeviceBase = DeviceBase, Location = string> {
	/**
	 * Manager options.
	 */
	private readonly options: DeepRequired<DeepReadonly<CookieSessionManagerOptions<Device, Location>>>;

	/**
	 * Sessions that were renewed and are about to expire very soon. <br/>
	 * This acts as *atomic flag* at the NodeJS process level,
	 * to mark the session as being renewed and prevent further renews on it. <br/>
	 */
	private readonly renewedSessions: Map<SessionId, NodeJS.Timeout>;

	/**
	 * @param options		Options object. <br/>
	 * 						It should not be modified after, as it will be used without being cloned.
	 */
	public constructor(options: CookieSessionManagerOptions<Device, Location>) {
		this.options = CookieSessionManager.fillWithDefaults(options);
		this.renewedSessions = new Map();
	}

	/**
	 * Name of the cookie where session id will be stored.
	 */
	public get sessionCookieName(): string {
		return this.options.cookie.name;
	}

	/**
	 * Create new user session for `subject`. <br/>
	 * Independently of the cache policy defined by the web application,
	 * if caching web application contents is allowed, the session IDs must never be cached,
	 * so it is highly recommended to use the **Cache-Control: no-cache="Set-Cookie, Set-Cookie2"** directive,
	 * to allow web clients to cache everything except the session ID.
	 *
	 * @param subject		Subject the session will belong to.
	 * @param context		Operation context.
	 *
	 * @returns		Serialized cookie with user session id.
	 */
	public async create(subject: string, context: UserSessionOperationContext<Device, Location>): Promise<string> {
		const currentTimestamp = CookieSessionManager.currentTimestamp();

		const sessionId = await safeUid(this.options.idLength);

		((context as unknown) as MutableSome<UserSessionMetaData<Device, Location>, 'subject'>).subject = subject;
		((context as unknown) as MutableSome<UserSessionMetaData<Device, Location>, 'createdAt'>).createdAt = currentTimestamp;
		((context as unknown) as MutableSome<UserSessionMetaData<Device, Location>, 'accessedAt'>).accessedAt = currentTimestamp;

		await this.options.storage.insert(sessionId, context as UserSessionMetaData<Device, Location>, this.options.cookie.maxAge);

		return serialize(this.options.cookie.name, sessionId, this.options.cookie);
	}

	/**
	 * Read user session from external storage. <br/>
	 * When idle functionality is activated, this method might delete user session and throw an error to notify about this,
	 * if it was idle for more than {@link CookieSessionManagerOptions.timeouts.idle} seconds. <br/>
	 * When renew functionality is activated, this method might create a new user session, and return it as the second part of the tuple.
	 * In case renewed session cookie is returned, it needs to be sent to application clients via 'Set-Cookie' header to replace the old session cookie.
	 * The old session will still be available for {@link CookieSessionManagerOptions.timeouts.oldSessionAvailabilityTimeoutAfterRenewal} seconds,
	 * so that older requests might complete successfully and client has time to refresh session id on it's side.
	 *
	 * @param sessionId		Session id taken from cookie.
	 * @param context		Operation context.
	 *
	 * @throws {Exception}	With the following error codes:
	 * 						- {@link ErrorCodes.NOT_FOUND}		- session wasn't found in the storage
	 * 						- {@link ErrorCodes.NOT_ALLOWED} 	- session is accessed from a device which differs from the one it was created
	 * 						- {@link ErrorCodes.EXPIRED}		- session was expired because of the idle timeout
	 *
	 * @returns		A tuple with the following parts:
	 * 				- session metadata
	 * 				- serialized cookie with the renewed session id (if renewal took place)
	 */
	public async read(
		sessionId: SessionId,
		context: UserSessionOperationContext<Device, Location>
	): Promise<[Readonly<UserSessionMetaData<Device, Location>>, string | null]> {
		const sessionMetaData = await this.options.storage.read(sessionId);
		if (sessionMetaData == null) {
			throw createException(
				ErrorCodes.NOT_FOUND,
				`Session '${CookieSessionManager.hash(sessionId)}' doesn't exist. Context: ${JSON.stringify(context)}.`
			);
		}

		this.options.readUserSessionHook(sessionId, context, sessionMetaData);

		const currentTimestamp = CookieSessionManager.currentTimestamp();

		if (this.options.timeouts.renewal) {
			const sessionAge = currentTimestamp - sessionMetaData.createdAt;
			if (sessionAge >= this.options.timeouts.renewal) {
				const renewedSessionCookie = await this.renew(sessionId, sessionMetaData, context);
				return [sessionMetaData, renewedSessionCookie];
			}
		}

		if (this.options.timeouts.idle) {
			const timeSinceLastAccess = currentTimestamp - sessionMetaData.accessedAt;
			if (timeSinceLastAccess >= this.options.timeouts.idle) {
				await this.options.storage.delete(sessionId);
				throw createException(
					ErrorCodes.EXPIRED,
					`Session '${CookieSessionManager.hash(
						sessionId
					)}' it's expired, because it was idle for ${timeSinceLastAccess} seconds. Context: ${JSON.stringify(context)}.`
				);
			}
		}

		await this.options.storage.update(sessionId, { accessedAt: currentTimestamp }, CommitType.DEBOUNCED);
		return [sessionMetaData, null];
	}

	/**
	 * Read all active sessions of the subject.
	 *
	 * @param subject	Subject.
	 *
	 * @returns		Active sessions of the subject.
	 */
	public readAll(subject: string): Promise<ReadonlyMap<SessionId, Readonly<UserSessionMetaData<Device, Location>>>> {
		return this.options.storage.readAll(subject);
	}

	/**
	 * Renew user session. <br/>
	 * Renewing consist from the following actions:
	 * 	1. scheduling deletion of the old session in a very short amount of time
	 * 	2. creating a new user session
	 *
	 * @param sessionId				Id of the session to be renewed.
	 * @param sessionMetaData		Metadata of that session.
	 * @param context				Operation context.
	 *
	 * @returns		Serialized cookie with the new user session id. <br/>
	 * 				When renew can't be performed, a log message is printed and *null* is returned.
	 */
	public async renew(
		sessionId: SessionId,
		sessionMetaData: UserSessionMetaData<Device, Location>,
		context: UserSessionOperationContext<Device, Location>
	): Promise<string | null> {
		if (this.renewedSessions.has(sessionId)) {
			this.options.logger.warning(
				`Can't renew session '${CookieSessionManager.hash(sessionId)}', because it was renewed already. Renew has been made from this NodeJS process.`
			);
			return null;
		}

		if (sessionMetaData.accessedAt === RENEWED_SESSION_FLAG) {
			this.options.logger.warning(
				`Can't renew session '${CookieSessionManager.hash(
					sessionId
				)}', because it was renewed already. Renew has been made from another NodeJS process.`
			);
			return null;
		}

		// notify others first, so that they do not try to renew it too
		try {
			this.renewedSessions.set(sessionId, null!);
			await this.options.storage.update(sessionId, { accessedAt: RENEWED_SESSION_FLAG }, CommitType.IMMEDIATE);
		} catch (e) {
			this.renewedSessions.delete(sessionId);
			throw e;
		}

		// then, schedule deletion of the marked as renewed session
		this.renewedSessions.set(
			sessionId,
			setTimeout(
				() =>
					this.delete(sessionId).catch((e) =>
						this.options.logger.error(`Failed to delete renewed session '${CookieSessionManager.hash(sessionId)}'.`, e)
					),
				this.options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal * 1000
			)
		);

		// create new session
		return this.create(sessionMetaData.subject, context);
	}

	/**
	 * Delete user session.
	 *
	 * @param sessionId		Id of the user session.
	 */
	public async delete(sessionId: SessionId): Promise<void> {
		const deleteOfRenewedSessionTimeout = this.renewedSessions.get(sessionId);
		if (deleteOfRenewedSessionTimeout != null) {
			clearTimeout(deleteOfRenewedSessionTimeout);
			this.renewedSessions.delete(sessionId);
		}

		await this.options.storage.delete(sessionId);
	}

	/**
	 * Delete all of the user sessions.
	 *
	 * @param subject	Subject.
	 *
	 * @returns		Number of deleted sessions.
	 */
	public deleteAll(subject: string): Promise<number> {
		return this.options.storage.deleteAll(subject);
	}

	/**
	 * Hashes session id.
	 *
	 * @private		Used for test purposes.
	 *
	 * @param sessionId		Session id.
	 *
	 * @returns				Hashed session id.
	 */
	public static hash(sessionId: string): string {
		return createHash('sha1').update(sessionId).digest('base64');
	}

	private static fillWithDefaults<Dev extends DeviceBase, Loc>(
		options: CookieSessionManagerOptions<Dev, Loc>
	): DeepRequired<CookieSessionManagerOptions<Dev, Loc>> {
		if (options.idLength < 15) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Session id length can't be lower than 15 characters. Given: ${options.idLength}.`);
		}

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

		if (options.timeouts == null) {
			options.timeouts = {};
		} else {
			// if idle session feature is enabled
			if (options.timeouts.idle != null) {
				if (options.timeouts.idle <= 0 || options.timeouts.idle >= options.cookie.maxAge) {
					throw createException(ErrorCodes.INVALID, `Idle timeout needs to be >0 && <${options.cookie.maxAge}. Given ${options.timeouts.idle}`);
				}
			}

			// if session renewal feature is enabled
			if (options.timeouts.renewal != null) {
				if (options.timeouts.renewal <= 0 || options.timeouts.renewal >= options.cookie.maxAge) {
					throw createException(ErrorCodes.INVALID, `Renew timeout needs to be >0 && <${options.cookie.maxAge}. Given ${options.timeouts.renewal}`);
				}

				if (options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal == null) {
					throw createException(
						ErrorCodes.REQUIRED,
						"'timeouts.oldSessionAvailabilityTimeoutAfterRenewal' is a required property when 'timeouts.renewal' is set."
					);
				}

				if (
					options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal <= 0 ||
					options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal >= options.cookie.maxAge
				) {
					throw createException(
						ErrorCodes.INVALID,
						`'timeouts.oldSessionAvailabilityTimeoutAfterRenewal' needs to be >0 && <${options.cookie.maxAge}. Given ${options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal}.`
					);
				}
			}
		}

		if (options.readUserSessionHook == null) {
			options.readUserSessionHook = CookieSessionManager.readUserSessionHook;
		}

		return options as DeepRequired<CookieSessionManagerOptions<Dev, Loc>>;
	}

	private static readUserSessionHook<Dev extends DeviceBase, Loc>(
		sessionId: SessionId,
		context: UserSessionOperationContext<Dev, Loc>,
		sessionMetaData: Readonly<UserSessionMetaData<Dev, Loc>>
	): void {
		if (context.device && sessionMetaData.device) {
			if (context.device.type !== sessionMetaData.device.type || context.device.name !== sessionMetaData.device.name) {
				throw createException(
					ErrorCodes.NOT_ALLOWED,
					`Attempting to access session '${CookieSessionManager.hash(sessionId)}' of the subject '${
						sessionMetaData.subject
					}' from a device which differs from the one session was created. Context: ${JSON.stringify(context)}.`
				);
			}
		}
	}

	private static currentTimestamp(): UnixTimestamp {
		return Math.floor(new Date().getTime() / 1000);
	}
}

function isLowerCase(str: string): boolean {
	return str.toLowerCase() === str;
}

export { CookieSessionManager, CookieSessionManagerOptions, RENEWED_SESSION_FLAG };
