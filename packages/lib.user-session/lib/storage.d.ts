import type { UnixTimestamp } from '@thermopylae/core.declarations';
import type { DeviceBase, SessionId, Subject, UserSessionStorage as BaseUserSessionStorage } from '@thermopylae/lib.user-session.commons';
import type { UserSessionMetaData } from './session';

/**
 * Type of the commit in the session storage.
 */
declare const enum CommitType {
	/**
	 * Update operation should be performed immediately in the storage.
	 */
	IMMEDIATE,
	/**
	 * Update operation should be debounced with ~1 second.
	 */
	DEBOUNCED
}

/**
 * Storage where user sessions are stored.
 *
 * @template Device		Type of the device.
 * @template Location	Type of the location.
 */
declare interface UserSessionsStorage<Device extends DeviceBase, Location>
	extends BaseUserSessionStorage<Device, Location, UserSessionMetaData<Device, Location>> {
	/**
	 * Caller will pass an newly created {@link UserSessionMetaData} object which has update {@link UserSessionMetaData.accessedAt} field.
	 * Storage needs to *replace* existing metadata with the passed one. <br/>
	 * > **Notice** that this is a safe operation, because other fields are readonly. <br/>
	 *
	 * Behaviours expected depending on `commitType` parameter: <br/>
	 * - {@link CommitType.DEBOUNCED} - function should schedule update, and return immediately; also it should handle any exceptions and log them. <br/>
	 * - {@link CommitType.IMMEDIATE} - this function should apply update immediately, and then return; any exceptions that might occur should be thrown to caller.
	 *
	 * @param subject		Subject.
	 * @param sessionId		Id of the session. <br/>
	 * 						Storage should treat `sessionId` as untrusted and
	 * 						perform SQLi and XSS validations before updating meta data.
	 * @param metaData		Session metadata with updated value of the {@link UserSessionMetaData.accessedAt} field.
	 * @param commitType	Commit type.
	 */
	updateAccessedAt(subject: Subject, sessionId: SessionId, metaData: UserSessionMetaData<Device, Location>, commitType: CommitType): Promise<void>;
}

export { UserSessionsStorage, CommitType };
