import { ErrorCodes } from '@thermopylae/core.declarations';
import type { Seconds, UnixTimestamp, MutableSome } from '@thermopylae/core.declarations';
import type { Subject, SessionId, DeviceBase, UserSessionOperationContext, ReadUserSessionHook } from '@thermopylae/lib.user-session.commons';
import safeUid from 'uid-safe';
import { createHash } from 'crypto';
import { createException } from './error';
import type { UserSessionMetaData } from './session';
import type { UserSessionsStorage } from './storage';

/**
 * Hooks called when session is renewed. <br/>
 * Mainly can be used for logging purposes.
 */
interface RenewSessionHooks {
	/**
	 * Hook called when making an attempt to renew user session, but it was
	 * renewed already from current NodeJs process.
	 *
	 * @param sessionId		Id of the session that was tried to be renewed.
	 */
	onRenewMadeAlreadyFromCurrentProcess(sessionId: string): void;

	/**
	 * Hook called when making an attempt to renew user session, but it was
	 * renewed already from another NodeJs process.
	 *
	 * @param sessionId		Id of the session that was tried to be renewed.
	 */
	onRenewMadeAlreadyFromAnotherProcess(sessionId: string): void;

	/**
	 * After successful renew operation, the deletion of old session will be scheduled to occur
	 * after {@link UserSessionTimeouts.oldSessionAvailabilityTimeoutAfterRenewal} seconds. <br/>
	 * In case the deletion of the old session will fail, this hook will be called with that error.
	 *
	 * @param sessionId		Id of the session.
	 * @param e				Error that caused failure of the old session deletion.
	 */
	onOldSessionDeleteFailure(sessionId: string, e: Error): void;
}

interface UserSessionTimeouts {
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
	 * If {@link UserSessionManagerOptions.timeouts.renewal} option is not set, this option is ignored. <br/>
	 * **Required** when {@link UserSessionManagerOptions.timeouts.renewal} option is set.
	 * **Recommended** value is *5*.
	 */
	readonly oldSessionAvailabilityTimeoutAfterRenewal?: Seconds;
}

interface UserSessionManagerOptions<Device extends DeviceBase, Location> {
	/**
	 * Length of the generated session id. <br/>
	 * Because base64 encoding is used underneath, this is not the string length.
	 * For example, to create a token of length 24, you want a byte length of 18. <br/>
	 * Value of this option should not be lower than 15. <br/>
	 * > **Important!** To prevent brute forcing [create long enough session id's](https://security.stackexchange.com/questions/81519/session-hijacking-through-sessionid-brute-forcing-possible).
	 */
	readonly idLength: number;
	/**
	 * Time To Live of the user session (in seconds).
	 */
	readonly sessionTtl: Seconds;
	/**
	 * Storage where users sessions are stored.
	 */
	readonly storage: UserSessionsStorage<Device, Location>;
	/**
	 * User session lifetime timeouts.
	 */
	readonly timeouts?: UserSessionTimeouts;
	/**
	 * Read user session hook. <br/>
	 * Defaults to hook which ensures that in case device is present in both context and session metadata,
	 * their *name* and *type* needs to be equal.
	 */
	readonly readUserSessionHook?: ReadUserSessionHook<Device, Location, UserSessionMetaData<Device, Location>>;
	/**
	 * Hooks called on session renew. <br/>
	 * Defaults to noop hooks.
	 */
	readonly renewSessionHooks?: RenewSessionHooks;
}

/**
 * Mark session as being renewed.
 *
 * @private
 */
const RENEWED_SESSION_FLAG = -1;

/**
 * Stateful implementation of the user sessions. <br/>
 * Session data is stored in external storage and client receives only it's id. <br/>
 * Sessions are implemented in a such way, so that they can be used in cluster or single-node infrastructures.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
class UserSessionManager<Device extends DeviceBase = DeviceBase, Location = string> {
	/**
	 * Manager options.
	 */
	private readonly options: Required<UserSessionManagerOptions<Device, Location>>;

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
	public constructor(options: UserSessionManagerOptions<Device, Location>) {
		this.options = UserSessionManager.fillWithDefaults(options);
		this.renewedSessions = new Map();
	}

	/**
	 * Create new user session for `subject`.
	 *
	 * @param subject		Subject the session will belong to.
	 * @param context		Operation context.
	 * @param sessionTtl	Session ttl. Takes precedence over the default one.
	 *
	 * @returns				User session id.
	 */
	public async create(subject: Subject, context: UserSessionOperationContext<Device, Location>, sessionTtl?: Seconds): Promise<SessionId> {
		const sessionId = await safeUid(this.options.idLength);
		if (!sessionTtl) {
			sessionTtl = this.options.sessionTtl;
		}

		const currentTimestamp = UserSessionManager.currentTimestamp();
		(context as unknown as MutableSome<UserSessionMetaData<Device, Location>, 'createdAt'>).createdAt = currentTimestamp;
		(context as unknown as MutableSome<UserSessionMetaData<Device, Location>, 'accessedAt'>).accessedAt = currentTimestamp;
		(context as unknown as MutableSome<UserSessionMetaData<Device, Location>, 'expiresAt'>).expiresAt = currentTimestamp + sessionTtl;

		await this.options.storage.insert(subject, sessionId, context as UserSessionMetaData<Device, Location>, sessionTtl);

		return sessionId;
	}

	/**
	 * Read user session from external storage. <br/>
	 * When idle functionality is activated, this method might delete user session and throw an error to notify about this,
	 * if it was idle for more than {@link UserSessionManagerOptions.timeouts.idle} seconds. <br/>
	 * When renew functionality is activated, this method might create a new user session, and return it's id as the second part of the tuple.
	 * In case renewed session id is returned, it needs to be sent to application clients via 'Set-Cookie' header to replace the old session cookie.
	 * The old session will still be available for {@link UserSessionManagerOptions.timeouts.oldSessionAvailabilityTimeoutAfterRenewal} seconds,
	 * so that older requests might complete successfully and client has time to refresh session id on it's side.
	 *
	 * @param subject		Subject.
	 * @param sessionId		Session id.
	 * @param context		Operation context.
	 *
	 * @throws {Exception}	With the following error codes:
	 * 						- {@link ErrorCodes.NOT_FOUND}		- session wasn't found in the storage
	 * 						- {@link ErrorCodes.NOT_ALLOWED} 	- session is accessed from a device which differs from the one it was created
	 * 						- {@link ErrorCodes.EXPIRED}		- session was expired because of the idle timeout
	 *
	 * @returns		A tuple with the following parts:
	 * 				- session metadata
	 * 				- renewed session id (if renewal took place)
	 */
	public async read(
		subject: Subject,
		sessionId: SessionId,
		context: UserSessionOperationContext<Device, Location>
	): Promise<[Readonly<UserSessionMetaData<Device, Location>>, string | null]> {
		const sessionMetaData = await this.options.storage.read(subject, sessionId);
		if (sessionMetaData == null) {
			throw createException(ErrorCodes.NOT_FOUND, `Session '${UserSessionManager.hash(sessionId)}' doesn't exist. Context: ${JSON.stringify(context)}.`);
		}

		this.options.readUserSessionHook(subject, sessionId, context, sessionMetaData);

		const currentTimestamp = UserSessionManager.currentTimestamp();

		if (this.options.timeouts.renewal) {
			const sessionAge = currentTimestamp - sessionMetaData.createdAt;
			if (sessionAge >= this.options.timeouts.renewal) {
				// renew will update `accessedAt` field for `sessionMetaData` object with the `RENEWED_SESSION_FLAG` constant
				return [sessionMetaData, await this.renew(subject, sessionId, sessionMetaData, context)];
			}
		}

		if (this.options.timeouts.idle) {
			const timeSinceLastAccess = currentTimestamp - sessionMetaData.accessedAt;
			if (timeSinceLastAccess >= this.options.timeouts.idle) {
				await this.options.storage.delete(subject, sessionId);
				throw createException(
					ErrorCodes.EXPIRED,
					`Session '${UserSessionManager.hash(
						sessionId
					)}' it's expired, because it was idle for ${timeSinceLastAccess} seconds. Context: ${JSON.stringify(context)}.`
				);
			}
		}

		sessionMetaData.accessedAt = currentTimestamp;
		await this.options.storage.updateAccessedAt(subject, sessionId, sessionMetaData);

		return [sessionMetaData, null];
	}

	/**
	 * Read all active sessions of the subject.
	 *
	 * @param subject	Subject.
	 *
	 * @returns		Active sessions of the subject.
	 */
	public readAll(subject: Subject): Promise<ReadonlyMap<SessionId, Readonly<UserSessionMetaData<Device, Location>>>> {
		return this.options.storage.readAll(subject);
	}

	/**
	 * Renew user session. <br/>
	 * Renewing consist from the following actions:
	 * 	1. scheduling deletion of the old session in a very short amount of time
	 * 	2. creating a new user session
	 *
	 * @param subject				Subject.
	 * @param sessionId				Id of the session to be renewed.
	 * @param sessionMetaData		Metadata of that session.
	 * @param context				Operation context.
	 *
	 * @returns		The new user session id. <br/>
	 * 				When renew can't be performed, a log message is printed and *null* is returned.
	 */
	public async renew(
		subject: Subject,
		sessionId: SessionId,
		sessionMetaData: UserSessionMetaData<Device, Location>,
		context: UserSessionOperationContext<Device, Location>
	): Promise<string | null> {
		if (this.renewedSessions.has(sessionId)) {
			this.options.renewSessionHooks.onRenewMadeAlreadyFromCurrentProcess(sessionId);
			return null;
		}

		if (sessionMetaData.accessedAt === RENEWED_SESSION_FLAG) {
			this.options.renewSessionHooks.onRenewMadeAlreadyFromAnotherProcess(sessionId);
			return null;
		}

		// notify others first, so that they do not try to renew it too
		try {
			this.renewedSessions.set(sessionId, null!);

			sessionMetaData.accessedAt = RENEWED_SESSION_FLAG;
			await this.options.storage.updateAccessedAt(subject, sessionId, sessionMetaData);
		} catch (e) {
			this.renewedSessions.delete(sessionId);
			throw e;
		}

		// then, schedule deletion of the marked as renewed session
		this.renewedSessions.set(
			sessionId,
			setTimeout(
				() => this.delete(subject, sessionId).catch((e) => this.options.renewSessionHooks.onOldSessionDeleteFailure(sessionId, e)),
				this.options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal! * 1000
			)
		);

		// create new session
		return this.create(subject, context, sessionMetaData.expiresAt - sessionMetaData.createdAt);
	}

	/**
	 * Delete user session.
	 *
	 * @param subject		Subject.
	 * @param sessionId		Id of the user session.
	 */
	public async delete(subject: Subject, sessionId: SessionId): Promise<void> {
		await this.options.storage.delete(subject, sessionId);

		const deleteOfRenewedSessionTimeout = this.renewedSessions.get(sessionId);
		if (deleteOfRenewedSessionTimeout != null) {
			clearTimeout(deleteOfRenewedSessionTimeout);
			this.renewedSessions.delete(sessionId);
		}
	}

	/**
	 * Delete all of the user sessions.
	 *
	 * @param subject	Subject.
	 *
	 * @returns		Number of deleted sessions.
	 */
	public deleteAll(subject: Subject): Promise<number> {
		return this.options.storage.deleteAll(subject);
	}

	/**
	 * Hashes session id. <br/>
	 * Useful for logging purposes.
	 *
	 * @param sessionId		Session id.
	 *
	 * @returns				Hashed session id.
	 */
	public static hash(sessionId: SessionId): string {
		return createHash('sha1').update(sessionId).digest('base64');
	}

	private static fillWithDefaults<Dev extends DeviceBase, Loc>(options: UserSessionManagerOptions<Dev, Loc>): Required<UserSessionManagerOptions<Dev, Loc>> {
		if (options.idLength < 15) {
			throw createException(ErrorCodes.NOT_ALLOWED, `Session id length can't be lower than 15 characters. Given: ${options.idLength}.`);
		}

		if (options.timeouts == null) {
			(options as MutableSome<UserSessionManagerOptions<Dev, Loc>, 'timeouts'>).timeouts = {};
		} else {
			// if idle session feature is enabled
			if (options.timeouts.idle != null) {
				if (options.timeouts.idle <= 0 || options.timeouts.idle >= options.sessionTtl) {
					throw createException(ErrorCodes.INVALID, `Idle timeout needs to be >0 && <${options.sessionTtl}. Given ${options.timeouts.idle}`);
				}
			}

			// if session renewal feature is enabled
			if (options.timeouts.renewal != null) {
				if (options.timeouts.renewal <= 0 || options.timeouts.renewal >= options.sessionTtl) {
					throw createException(ErrorCodes.INVALID, `Renew timeout needs to be >0 && <${options.sessionTtl}. Given ${options.timeouts.renewal}`);
				}

				if (options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal == null) {
					throw createException(
						ErrorCodes.REQUIRED,
						"'timeouts.oldSessionAvailabilityTimeoutAfterRenewal' is a required property when 'timeouts.renewal' is set."
					);
				}

				if (
					options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal <= 0 ||
					options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal >= options.sessionTtl
				) {
					throw createException(
						ErrorCodes.INVALID,
						`'timeouts.oldSessionAvailabilityTimeoutAfterRenewal' needs to be >0 && <${options.sessionTtl}. Given ${options.timeouts.oldSessionAvailabilityTimeoutAfterRenewal}.`
					);
				}
			}
		}

		if (options.readUserSessionHook == null) {
			(options as MutableSome<UserSessionManagerOptions<Dev, Loc>, 'readUserSessionHook'>).readUserSessionHook = UserSessionManager.readUserSessionHook;
		}

		if (options.renewSessionHooks == null) {
			(options as MutableSome<UserSessionManagerOptions<Dev, Loc>, 'renewSessionHooks'>).renewSessionHooks = UserSessionManager.renewSessionHooks;
		}

		return options as Required<UserSessionManagerOptions<Dev, Loc>>;
	}

	public static currentTimestamp(): UnixTimestamp {
		return Math.floor(new Date().getTime() / 1000);
	}

	private static readUserSessionHook<Dev extends DeviceBase, Loc>(
		subject: Subject,
		sessionId: SessionId,
		context: UserSessionOperationContext<Dev, Loc>,
		sessionMetaData: Readonly<UserSessionMetaData<Dev, Loc>>
	): void {
		if (context.device && sessionMetaData.device) {
			if (context.device.type !== sessionMetaData.device.type || context.device.name !== sessionMetaData.device.name) {
				throw createException(
					ErrorCodes.NOT_ALLOWED,
					`Attempting to access session '${UserSessionManager.hash(
						sessionId
					)}' of the subject '${subject}' from a device which differs from the one session was created. Context: ${JSON.stringify(context)}.`
				);
			}
		}
	}

	private static renewSessionHooks: RenewSessionHooks = {
		onOldSessionDeleteFailure() {
			return undefined;
		},
		onRenewMadeAlreadyFromAnotherProcess() {
			return undefined;
		},
		onRenewMadeAlreadyFromCurrentProcess() {
			return undefined;
		}
	};
}

export { UserSessionManager, UserSessionManagerOptions, UserSessionTimeouts, RenewSessionHooks, RENEWED_SESSION_FLAG };
