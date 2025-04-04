import type { UserSessionStorage as BaseUserSessionStorage, DeviceBase, SessionId, Subject } from '@thermopylae/lib.user-session.commons';
import type { UserSessionMetaData } from './session.js';

/**
 * Storage where user sessions are stored.
 *
 * @template Device Type of the device.
 * @template Location Type of the location.
 */
interface UserSessionsStorage<Device extends DeviceBase, Location> extends BaseUserSessionStorage<Device, Location, UserSessionMetaData<Device, Location>> {
	/**
	 * Caller will pass an {@link UserSessionMetaData} object (the same one which was obtained from
	 * {@link UserSessionsStorage.read} operation, without being cloned) which has updated
	 * {@link UserSessionMetaData.accessedAt} field. Storage needs to _replace_ existing metadata
	 * with the passed one. <br/>
	 *
	 * > **Notice** that this is a safe operation, because other fields are readonly. <br/>
	 *
	 * @param subject   Subject.
	 * @param sessionId Id of the session. <br/> Storage should treat `sessionId` as untrusted and
	 *   perform SQLi and XSS validations before updating meta data.
	 * @param metaData  Session metadata with updated value of the
	 *   {@link UserSessionMetaData.accessedAt} field.
	 */
	updateAccessedAt(subject: Subject, sessionId: SessionId, metaData: UserSessionMetaData<Device, Location>): Promise<void>;
}

export type { UserSessionsStorage };
