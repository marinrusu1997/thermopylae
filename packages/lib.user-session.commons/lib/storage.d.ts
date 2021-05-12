import type { Seconds } from '@thermopylae/core.declarations';
import type { SessionId, Subject, UserSessionMetaData, DeviceBase } from './session';

/**
 * Storage where user sessions are stored.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 * @template MetaData   Type of the session metadata.
 */
declare interface UserSessionStorage<
	Device extends DeviceBase,
	Location,
	MetaData extends UserSessionMetaData<Device, Location> = UserSessionMetaData<Device, Location>
> {
	/**
	 * Insert user session in the storage. <br/>
	 *
	 * > **IMPORTANT!** <br/>
	 * > It's highly advisable to hash `sessionId` before storing it in the database, especially if RDBMS is used.
	 *
	 * @param subject		Subject.
	 * @param sessionId		Session id.
	 * @param metaData		Session meta data.
	 * @param ttl			Session ttl (in seconds).
	 */
	insert(subject: Subject, sessionId: SessionId, metaData: MetaData, ttl: Seconds): Promise<void>;

	/**
	 * Read session meta data from storage.
	 *
	 * @param subject		Subject.
	 * @param sessionId		Id of the session. <br/>
	 * 						Storage should treat `sessionId` as untrusted and
	 * 						perform SQLi and XSS validations before query meta data.
	 *
	 * @returns				User session meta data or *undefined* if not found.
	 */
	read(subject: Subject, sessionId: SessionId): Promise<MetaData | undefined>;

	/**
	 * Read all of the **active** user sessions for `subject`.
	 *
	 * @param subject	Subject user sessions are belonging to.
	 *
	 * @returns			Session id with the session metadata. <br/>
	 * 					When `subject` has no active sessions, returns an empty map.
	 */
	readAll(subject: Subject): Promise<ReadonlyMap<SessionId, Readonly<MetaData>>>;

	/**
	 * Deletes user session.
	 *
	 * @param subject		Subject.
	 * @param sessionId		Id of the session. <br/>
	 * 						Storage should treat `sessionId` as untrusted and
	 * 						perform SQLi and XSS validations before deleting meta data.
	 */
	delete(subject: Subject, sessionId: SessionId): Promise<void>;

	/**
	 * Deletes all sessions of the `subject`.
	 *
	 * @param subject	Subject.
	 *
	 * @returns			Number of deleted sessions.
	 */
	deleteAll(subject: Subject): Promise<number>;
}

export { UserSessionStorage };
