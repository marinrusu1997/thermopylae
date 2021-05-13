import { UserSessionRedisStorage as BaseUserSessionRedisStorage } from '@thermopylae/core.user-session.commons';
import { ConnectionType, RedisClientInstance } from '@thermopylae/core.redis';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { CommitType } from '@thermopylae/lib.user-session';
import debounce from 'lodash.debounce';
import type { UserSessionRedisStorageOptions, UserSessionDevice } from '@thermopylae/core.user-session.commons';
import type { HTTPRequestLocation, UnixTimestamp } from '@thermopylae/core.declarations';
import type { UserSessionsStorage, UserSessionMetaData } from '@thermopylae/lib.user-session';
import type { Subject, SessionId } from '@thermopylae/lib.user-session.commons';
import { createException } from './error';

class UserSessionRedisStorage
	extends BaseUserSessionRedisStorage<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>
	implements UserSessionsStorage<UserSessionDevice, HTTPRequestLocation>
{
	private readonly debouncedFunctions: Map<Subject, Map<SessionId, typeof UserSessionRedisStorage.prototype.doUpdateAccessedAt>>;

	public constructor(options: UserSessionRedisStorageOptions<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>) {
		super(options);

		this.debouncedFunctions = new Map();
	}

	public async updateAccessedAt(subject: Subject, sessionId: SessionId, accessedAt: UnixTimestamp, commitType: CommitType): Promise<void> {
		switch (commitType) {
			case CommitType.IMMEDIATE:
				await this.doUpdateAccessedAt(subject, sessionId, accessedAt);
				break;

			case CommitType.DEBOUNCED:
				break;
			default:
				throw createException(ErrorCodes.UNKNOWN, `Can't handle commit type: ${commitType}`);
		}
	}

	private async doUpdateAccessedAt(subject: Subject, sessionId: SessionId, accessedAt: UnixTimestamp): Promise<void> {}
}

export { UserSessionRedisStorage };
