import { ErrorCodes, Seconds, UnixTimestamp } from '@thermopylae/core.declarations';
import { serialize } from 'cookie';
import safeUid from 'uid-safe';
import equals from 'fast-deep-equal';
import { createHash } from 'crypto';
import type { DeepRequired } from 'utility-types';
import { logger } from './logger';
import { createException } from './error';
import { CommitType, SessionsStorage } from './storage';
import { SessionId, SessionMetaData, SessionOperationContext } from './session';

interface CookieSessionManagerOptions {
	/**
	 * Length of the generated session id. <br/>
	 * Because base64 encoding is used underneath, this is not the string length.
	 * For example, to create a token of length 24, you want a byte length of 18. <br/>
	 * Value of this option should not be lower than 15. <br/>
	 * **Defaults** to *18*.
	 */
	idLength?: number;
	/**
	 * Session id cookie options.
	 */
	cookie: {
		/**
		 * Name of the cookie where session id will be stored. <br/>
		 * Notice that this name should be unpredictable one (e.g. not 'sid', 'id' etc). <br/>
		 * Also, cookie name should not begin with *__Host-* or *__Secure-* prefixes, as they will be added automatically.
		 * **Defaults** to *zvf*.
		 */
		name?: string;
		/**
		 * **Defaults** to *true*.
		 */
		secure?: boolean;
		/**
		 * Cookie and session ttl.
		 */
		maxAge: Seconds;
		/**
		 * **Defaults** to *true*.
		 */
		httpOnly?: boolean;
		/**
		 * **Defaults** to *undefined*.
		 */
		domain?: string;
		/**
		 * **Defaults** to *'/'*.
		 */
		path?: string;
		/**
		 * **Defaults** to *strict*.
		 */
		sameSite?: 'lax' | 'strict' | 'none';
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
		idle?: Seconds;
		/**
		 * This timeout defines the amount of time in seconds since session creation
		 * after which the session ID is automatically renewed, in the middle of the user session,
		 * and independently of the session activity and, therefore, of the idle timeout. <br/>
		 * Renewal consists in deletion of the old session and creation of a new one. <br/>
		 * If you do not need idle session feature, do not set this option. <br/>
		 * **Defaults** to *undefined*.
		 */
		renewal?: Seconds;
		/**
		 * This timeout defines the amount of time the old session will still be available after it was renewed. <br/>
		 * This timeout starts counting from renew session operation, and on elapse will delete the old session. <br/>
		 * Usually you will want to keep this timeout as small as possible to give a chance to requests that
		 * were issued before renew operation to finish successfully, and then invalidate old session.
		 * If {@link CookieSessionManagerOptions.timeouts.renewal} option is not set, this option is ignored. <br/>
		 * **Defaults** to *5 seconds*.
		 */
		oldSessionAvailabilityTimeoutAfterRenewal?: Seconds;
	};
	/**
	 * Storage where users sessions are stored.
	 */
	storage: SessionsStorage;
}

/**
 * Mark session as being renewed.
 */
const RENEWED_SESSION_FLAG = -1;

/**
 * Stateful implementation of the user sessions using cookies as exchange mechanism. <br/>
 * Session data is stored in external storage and client receives only it's id. <br/>
 * Sessions are implemented in a such way, so that they can be used in cluster or single-node infrastructures. <br/>
 */
class CookieSessionManager {
	/**
	 * Manager options.
	 */
	private readonly options: DeepRequired<CookieSessionManagerOptions>;

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
	public constructor(options: CookieSessionManagerOptions) {
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
	public async create(subject: string, context: SessionOperationContext): Promise<string> {
		const currentTimestamp = CookieSessionManager.currentTimestamp();

		const sessionId = await safeUid(this.options.idLength);
		const sessionMetaData: SessionMetaData = {
			subject,
			ip: context.ip,
			device: context.device,
			createdAt: currentTimestamp,
			accessedAt: currentTimestamp
		};
		await this.options.storage.insert(sessionId, sessionMetaData, this.options.cookie.maxAge);
		logger.info(`Created session '${CookieSessionManager.hash(sessionId)}' for subject '${subject}'. Context: ${JSON.stringify(context)}`);

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
	public async read(sessionId: SessionId, context: SessionOperationContext): Promise<[Readonly<SessionMetaData>, string | null]> {
		const sessionMetaData = await this.options.storage.read(sessionId);
		if (sessionMetaData == null) {
			throw createException(
				ErrorCodes.NOT_FOUND,
				`Session '${CookieSessionManager.hash(sessionId)}' doesn't exist. Context: ${JSON.stringify(context)}.`
			);
		}
		if (!equals(context.device, sessionMetaData.device)) {
			throw createException(
				ErrorCodes.NOT_ALLOWED,
				`Attempting to access session '${CookieSessionManager.hash(sessionId)}' of the subject '${
					sessionMetaData.subject
				}' from a device which differs from the one session was created. Context: ${JSON.stringify(context)}.`
			);
		}

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
	public readAll(subject: string): Promise<Array<Readonly<SessionMetaData>>> {
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
	public async renew(sessionId: SessionId, sessionMetaData: SessionMetaData, context: SessionOperationContext): Promise<string | null> {
		if (this.renewedSessions.has(sessionId)) {
			logger.warning(
				`Can't renew session '${CookieSessionManager.hash(sessionId)}', because it was renewed already. Renew has been made from this NodeJS process.`
			);
			return null;
		}

		if (sessionMetaData.accessedAt === RENEWED_SESSION_FLAG) {
			logger.warning(
				`Can't renew session '${CookieSessionManager.hash(
					sessionId
				)}', because it was renewed already. Renew has been made from another NodeJS process.`
			);
			return null;
		}

		logger.info(
			`Renewing session '${CookieSessionManager.hash(sessionId)}' created at ${sessionMetaData.createdAt} for subject '${sessionMetaData.subject}'.`
		);

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
				() => this.delete(sessionId).catch((e) => logger.error(`Failed to delete renewed session '${CookieSessionManager.hash(sessionId)}'.`, e)),
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

		if (await this.options.storage.delete(sessionId)) {
			logger.info(`Session '${CookieSessionManager.hash(sessionId)}' deleted successfully.`);
			return;
		}

		logger.warning(`Session '${CookieSessionManager.hash(sessionId)}' wasn't deleted.`);
	}

	/**
	 * Delete all of the user sessions.
	 *
	 * @param subject	Subject.
	 *
	 * @returns		Number of deleted sessions.
	 */
	public async deleteAll(subject: string): Promise<number> {
		const numberOfDeletedSessions = await this.options.storage.deleteAll(subject);
		logger.info(`Deleted ${numberOfDeletedSessions} active sessions of the subject '${subject}'.`);
		return numberOfDeletedSessions;
	}

	/**
	 * Hashes session id.
	 *
	 * @private		Used for test purposes.
	 * @param sessionId		Session id.
	 *
	 * @returns		Hashed session id.
	 */
	public static hash(sessionId: string): string {
		return createHash('sha1').update(sessionId).digest('base64');
	}

	private static fillWithDefaults(options: CookieSessionManagerOptions): DeepRequired<CookieSessionManagerOptions> {
		if (options.idLength == null) {
			options.idLength = 18;
		} else if (options.idLength < 15) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Session id length can't be lower than 15 characters. Given: ${options.idLength}.`);
		}

		if (options.cookie.name == null) {
			options.cookie.name = 'zvf';
		}
		if (options.cookie.secure == null) {
			options.cookie.secure = true;
		}
		if (options.cookie.httpOnly == null) {
			options.cookie.httpOnly = true;
		}
		if (options.cookie.path == null) {
			options.cookie.path = '/';
		}
		if (options.cookie.sameSite == null) {
			options.cookie.sameSite = 'strict';
		}

		if (options.cookie.domain == null && options.cookie.path === '/') {
			options.cookie.name = `__Host-${options.cookie.name}`;
		} else {
			options.cookie.name = `__Secure-${options.cookie.name}`;
		}

		if (options.timeouts == null) {
			options.timeouts = {};
		} else {
			if (options.timeouts.idle! <= 0 || options.timeouts.idle! >= options.cookie.maxAge) {
				throw createException(ErrorCodes.INVALID, `Idle timeout needs to be >0 && <${options.cookie.maxAge}. Given ${options.timeouts.idle}`);
			}

			if (options.timeouts.renewal != null) {
				if (options.timeouts.renewal <= 0 || options.timeouts.renewal >= options.cookie.maxAge) {
					throw createException(ErrorCodes.INVALID, `Renew timeout needs to be >0 && <${options.cookie.maxAge}. Given ${options.timeouts.renewal}`);
				}

				if (options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal != null) {
					if (
						options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal <= 0 ||
						options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal >= options.cookie.maxAge
					) {
						throw createException(
							ErrorCodes.INVALID,
							`Old session availability needs to be >0 && <${options.cookie.maxAge}. Given ${options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal}`
						);
					}
				} else {
					options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal = 5;
				}
			}
		}

		return options as DeepRequired<CookieSessionManagerOptions>;
	}

	private static currentTimestamp(): UnixTimestamp {
		return Math.floor(new Date().getTime() / 1000);
	}
}

export { CookieSessionManager, CookieSessionManagerOptions, RENEWED_SESSION_FLAG };
