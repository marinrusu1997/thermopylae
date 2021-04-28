import { Seconds } from '@thermopylae/core.declarations';
import { SessionId, SessionMetaData } from './session';

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
 */
declare interface SessionsStorage {
	/**
	 * Insert user session in the storage. <br/>
	 * In case RDBMS storage is used, it's recommended so that `sessionId` is stored in some hashed form.
	 *
	 * @param sessionId		Id of the session.
	 * @param metaData		Session meta data.
	 * @param ttl			Session ttl in seconds.
	 */
	insert(sessionId: SessionId, metaData: SessionMetaData, ttl: Seconds): Promise<void>;

	/**
	 * Read session meta data from storage. <br/>
	 *
	 * @param sessionId		Id of the session. <br/>
	 * 						Storage should treat `sessionId` as untrusted and
	 * 						perform SQLi and XSS validations before query meta data.
	 *
	 * @returns		Session meta data or *undefined* if not found.
	 */
	read(sessionId: SessionId): Promise<SessionMetaData | undefined>;

	/**
	 * Read all active sessions of the `subject`.
	 *
	 * @param subject		Subject sessions of which need to be retrieved.
	 */
	readAll(subject: string): Promise<Array<Readonly<SessionMetaData>>>;

	/**
	 * Update meta data of user session. Do not confuse it with *replace* operation. <br/>
	 * Only particular fields are updated, and update should be performed atomically. <br/>
	 * When `commitType` has {@link CommitType.DEBOUNCED} value, this function should
	 * schedule update, and return immediately; also it should handle any exceptions and log them. <br/>
	 * When `commitType` hsa {@link CommitType.IMMEDIATE} value, this function should
	 * apply update immediately, and then return; any exceptions that might occur should be thrown to caller.
	 *
	 * @param sessionId		Id of the session. <br/>
	 * 						Storage should treat `sessionId` as untrusted and
	 * 						perform SQLi and XSS validations before updating meta data.
	 * @param metaData		Session meta data.
	 * @param commitType	Commit type.
	 */
	update(sessionId: SessionId, metaData: Partial<SessionMetaData>, commitType: CommitType): Promise<void>;

	/**
	 * Deletes user session.
	 * If session doesn't exist, should return *false*.
	 *
	 * @param sessionId		Id of the session. <br/>
	 * 						Storage should treat `sessionId` as untrusted and
	 * 						perform SQLi and XSS validations before deleting meta data.
	 *
	 * @returns		Whether session was deleted successfully.
	 */
	delete(sessionId: SessionId): Promise<boolean>;

	/**
	 * Deletes all sessions of the `subject`.
	 *
	 * @param subject		Subject.
	 *
	 * @returns		Number of deleted sessions.
	 */
	deleteAll(subject: string): Promise<number>;
}

export { SessionsStorage, CommitType };
