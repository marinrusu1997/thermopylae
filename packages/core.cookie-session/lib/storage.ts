import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import { RedisClientInstance } from '@thermopylae/core.redis';
import { UserSessionRedisStorage as BaseUserSessionRedisStorage } from '@thermopylae/core.user-session.commons';
import type { UserSessionDevice } from '@thermopylae/core.user-session.commons';
import { UserSessionManager } from '@thermopylae/lib.user-session';
import type { UserSessionMetaData, UserSessionsStorage } from '@thermopylae/lib.user-session';
import type { SessionId, Subject } from '@thermopylae/lib.user-session.commons';
import { logger } from './logger.js';

/** @inheritDoc */
class UserSessionRedisStorage
	extends BaseUserSessionRedisStorage<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>
	implements UserSessionsStorage<UserSessionDevice, HTTPRequestLocation>
{
	public async updateAccessedAt(
		subject: Subject,
		sessionId: SessionId,
		metaData: UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>
	): Promise<void> {
		const wasUpdated = (await RedisClientInstance.client.set(
			this.sessionIdKeyBuffer(subject, sessionId) as unknown as string,
			this.options.serializer.serialize(metaData) as unknown as string,
			'KEEPTTL',
			'XX'
		)) as unknown as Buffer;

		if (wasUpdated == null) {
			// this might happen when we try to update key right after it was expired,
			// in any of the cases this is not a critic error, because on next read/renew it won't be available,
			// therefore making these operations impossible to perform
			logger.warning(`Failed to update 'accessedAt' of the session with id '${UserSessionManager.hash(sessionId)}' belonging to subject '${subject}'.`);
		}
	}
}

export { UserSessionRedisStorage };
