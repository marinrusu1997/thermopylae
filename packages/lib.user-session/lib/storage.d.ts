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
	 * Update meta data of user session. Do not confuse it with *replace* operation. <br/>
	 * Only particular fields are updated, and update should be performed atomically. <br/>
	 * When `commitType` has {@link CommitType.DEBOUNCED} value, this function should
	 * schedule update, and return immediately; also it should handle any exceptions and log them. <br/>
	 * When `commitType` hsa {@link CommitType.IMMEDIATE} value, this function should
	 * apply update immediately, and then return; any exceptions that might occur should be thrown to caller.
	 *
	 * @param subject		Subject.
	 * @param sessionId		Id of the session. <br/>
	 * 						Storage should treat `sessionId` as untrusted and
	 * 						perform SQLi and XSS validations before updating meta data.
	 * @param accessedAt	Updated value of the {@link UserSessionMetaData.accessedAt} field.
	 * @param commitType	Commit type.
	 */
	updateAccessedAt(subject: Subject, sessionId: SessionId, accessedAt: UnixTimestamp, commitType: CommitType): Promise<void>;
}

export { UserSessionsStorage, CommitType };
