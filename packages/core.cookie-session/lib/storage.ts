import type { SessionsStorage, UserSessionMetaData, SessionId } from '@thermopylae/lib.cookie-session';
import type { HTTPRequestLocation, Seconds } from '@thermopylae/core.declarations';
import { RedisClientInstance, ConnectionType } from '@thermopylae/core.redis';
import { ErrorCodes } from '@thermopylae/core.declarations';
import type { UserSessionDevice } from './typings';
import { createException } from './error';
import { logger } from './logger';

interface UserSessionsStorageOptions {
	/**
	 * Prefixes used for keys stored in Redis.
	 */
	readonly keyPrefix: {
		/**
		 * Key prefix used for storing a list of session id's belonging to a concrete subject.
		 */
		readonly sessions: string;
		/**
		 * Key prefix used for storing session id as key and session metadata as value.
		 */
		readonly sessionId: string;
	};
	/**
	 * Maximum number of concurrent sessions that a user can have. <br/>
	 * Creating a new session above this threshold will result in an error. <br/>
	 * When left *undefined*, user can have an unlimited number of sessions.
	 */
	readonly concurrentSessions?: number;
}

// @fixme code is too identical with the core .jwt-session

// @fixme also declarations need to be moved

// @fixme maybe we will made lib.abstract-session and core.base-session

class UserSessionsStorage implements SessionsStorage<UserSessionDevice, HTTPRequestLocation> {
	private readonly options: UserSessionsStorageOptions;

	public constructor(options: UserSessionsStorageOptions) {
		this.options = options;

		RedisClientInstance.on(ConnectionType.SUBSCRIBER, 'message', (channel, message) => {
			if (!channel.startsWith('__keyspace@') || !(message === 'del' || message === 'expired' || message === 'evicted')) {
				return;
			}

			const [, prefix, subject, sessionId] = channel.split(':');
			if (prefix !== this.options.keyPrefix.sessionId) {
				return;
			}

			RedisClientInstance.subscriber.unsubscribe(channel).catch((e) => {
				logger.error(`Failed to unsubscribe from '${channel}' channel.`, e);
			});

			RedisClientInstance.client.lrem(this.activeSessionsKey(subject), 1, sessionId).catch((e) => {
				logger.error(`Failed to remove '${sessionId}' from the list of active sessions of the subject '${subject}'.`, e);
			});
		});
	}

	public async insert(sessionId: SessionId, metaData: UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>, ttl: Seconds): Promise<void> {
		const activeSessionsKey = this.activeSessionsKey(metaData.subject);

		if (this.options.concurrentSessions) {
			const activeSessions = await RedisClientInstance.client.llen(activeSessionsKey);
			if (activeSessions >= this.options.concurrentSessions) {
				throw createException(
					ErrorCodes.OVERFLOW,
					`Concurrent user sessions limit reached for subject '${metaData.subject}', as he has ${activeSessions} active sessions.`
				);
			}
		}

		const sessionIdKey = this.sessionIdKey(metaData.subject, sessionId);

		const [sessionKeyWasSet, expireWasSet, activeSessions] = await RedisClientInstance.client
			.multi()
			.json_set(sessionIdKey, '.', JSON.stringify(metaData), 'NX')
			.expire(sessionIdKey, ttl) // @fixme take care of ttl reset on json_set operations, test it carefully
			.lpush(activeSessionsKey, sessionId)
			.exec();

		if (sessionKeyWasSet !== 'OK') {
			throw createException(ErrorCodes.NOT_CREATED, `Failed to insert user session under key '${sessionIdKey}'.`);
		}
		if (expireWasSet !== 1) {
			// @fixme maybe not needed, we know for sure the key was present before setting ttl
			await RedisClientInstance.client.json_del(sessionIdKey); // auto removal from list
			throw createException(ErrorCodes.NOT_CREATED, `Failed to insert user session under key '${sessionIdKey}', because expiration was not set.`);
		}

		logger.debug(`Inserted user session for subject '${metaData.subject}'. He has ${activeSessions} active sessions.`);

		await RedisClientInstance.subscriber.subscribe(`__keyspace@${RedisClientInstance.db}__:${sessionIdKey}`);
	}

	public async read(sessionId: string): Promise<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> | undefined> {
		const session = await RedisClientInstance.client.json_get(this.sessionIdKey(sessionId));

		const sessionBuffer = ((await RedisClientInstance.client.get(
			(this.refreshTokenKeyBuffer(subject, refreshToken) as unknown) as string
		)) as unknown) as Buffer;
		return sessionBuffer ? this.options.serializer.deserialize(sessionBuffer) : undefined;
	}

	readAll(subject: string): Promise<ReadonlyMap<string, Readonly<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>>> {
		throw new Error('Method not implemented.');
	}

	// @fixme make it update ttl
	update(sessionId: string, metaData: Partial<UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>>, commitType: CommitType): Promise<void> {
		throw new Error('Method not implemented.');
	}

	delete(sessionId: string): Promise<void> {
		throw new Error('Method not implemented.');
	}

	deleteAll(subject: string): Promise<number> {
		throw new Error('Method not implemented.');
	}

	private activeSessionsKey(subject: string): string {
		return `${this.options.keyPrefix.sessions}:${subject}`;
	}

	private sessionIdKey(subject: string, sessionId: SessionId): string {
		return `${this.options.keyPrefix.sessionId}:${subject}:${sessionId}`;
	}
}

export { UserSessionsStorage };
