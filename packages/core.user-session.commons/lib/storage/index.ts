import type { HTTPRequestLocation, Seconds } from '@thermopylae/core.declarations';
import { ConnectionType, RedisClientInstance } from '@thermopylae/core.redis';
import type { SessionId, Subject, UserSessionMetaData, UserSessionStorage } from '@thermopylae/lib.user-session.commons';
import { ErrorCodes, createException } from '../error.js';
import { logger } from '../logger.js';
import type { UserSessionDevice, UserSessionMetaDataSerializer } from '../typings.js';

interface UserSessionRedisStorageOptions<
	MetaData extends UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> = UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>
> {
	/** Prefixes used for keys stored in Redis. */
	readonly keyPrefix: {
		/** Key prefix used for storing a list of session id's belonging to a concrete subject. */
		readonly sessions: string;
		/** Key prefix used for storing session id as key and metadata as value. */
		readonly sessionId: string;
	};
	/**
	 * Maximum number of concurrent sessions that a user can have. <br/> Creating a new session
	 * above this threshold will result in an error. <br/> When left _undefined_, user can have an
	 * unlimited number of sessions.
	 */
	readonly concurrentSessions?: number;
	/** Serializer used for session metadata serialization. */
	readonly serializer: UserSessionMetaDataSerializer<MetaData>;
}

/**
 * User session storage backed by [Redis](https://redis.io/). <br/> This implementation uses
 * _core.redis_ as client and imposes the following requirements to him: <br/> -
 * {@link ConnectionType.SUBSCRIBER} connection needs to be established and available. **Key space
 * notification events needs to be enabled on Redis Server side.** This is needed for receiving of
 * key space notification events about refresh token keys deletion, expiration or eviction, in order
 * to remove them from list of active user sessions. <br/> - {@link ConnectionType.REGULAR}
 * connection needs to have **detect_buffers** option enabled, because it stores and reads
 * serialized user session metadata as {@link Buffer} instances. <br/> -
 * {@link RedisClientInstance.db} property should always return a valid db index. It is recommended
 * to not change db after {@link ConnectionType.REGULAR} connection was established.
 *
 * @template MetaData Type of the user session metadata.
 */
class UserSessionRedisStorage<
	MetaData extends UserSessionMetaData<UserSessionDevice, HTTPRequestLocation> = UserSessionMetaData<UserSessionDevice, HTTPRequestLocation>
> implements UserSessionStorage<UserSessionDevice, HTTPRequestLocation, MetaData>
{
	private static readonly NO_ACTIVE_SESSIONS: ReadonlyMap<SessionId, any> = new Map();

	private static GLOBAL_KEY_PREFIX: string | null = null;

	protected readonly options: Required<UserSessionRedisStorageOptions<MetaData>>;

	public constructor(options: UserSessionRedisStorageOptions<MetaData>) {
		this.options = options as Required<UserSessionRedisStorageOptions<MetaData>>;

		RedisClientInstance.on(ConnectionType.SUBSCRIBER, 'message', (channel, message) => {
			if (!channel.startsWith('__keyspace@') || !(message === 'del' || message === 'expired' || message === 'evicted')) {
				return;
			}

			const channelEncodedParts = channel.split(':');
			if (channelEncodedParts[channelEncodedParts.length - 3] !== this.options.keyPrefix.sessionId) {
				return;
			}

			RedisClientInstance.subscriber.unsubscribe(channel).catch((e) => {
				logger.error(`Failed to unsubscribe from '${channel}' channel.`, e);
			});

			const sessionId = channelEncodedParts[channelEncodedParts.length - 1];
			const subject = channelEncodedParts[channelEncodedParts.length - 2];

			RedisClientInstance.client.lrem(this.activeSessionsKey(subject), 1, sessionId).catch((e) => {
				logger.error(`Failed to remove '${sessionId}' from the list of active sessions of the subject '${subject}'.`, e);
			});
		});
	}

	public async insert(subject: Subject, sessionId: SessionId, metaData: MetaData, ttl: Seconds): Promise<void> {
		const activeSessionsKey = this.activeSessionsKey(subject);

		if (this.options.concurrentSessions) {
			const activeSessions = await RedisClientInstance.client.llen(activeSessionsKey);
			if (activeSessions >= this.options.concurrentSessions) {
				throw createException(
					ErrorCodes.TOO_MANY_CONCURRENT_USER_SESSIONS,
					`Concurrent user sessions limit reached for subject '${subject}', as he has ${activeSessions} active sessions.`
				);
			}
		}

		const sessionIdKey = this.sessionIdKey(subject, sessionId);

		const [wasSet, activeSessions] = (await RedisClientInstance.client
			.multi()
			.set(sessionIdKey, this.options.serializer.serialize(metaData) as unknown as string, ['EX', ttl], 'NX')
			.lpush(activeSessionsKey, sessionId)
			.exec()) as unknown as [Buffer, number];

		if (wasSet == null) {
			throw createException(ErrorCodes.USER_SESSION_INSERTION_FAILED, `Failed to insert user session under key '${sessionIdKey}'.`);
		}

		logger.debug(`Inserted user session for subject '${subject}'. He has ${activeSessions} active sessions.`);

		if (UserSessionRedisStorage.GLOBAL_KEY_PREFIX == null) {
			if (RedisClientInstance.connectionOptions.REGULAR.prefix == null || RedisClientInstance.connectionOptions.REGULAR.prefix.length === 0) {
				UserSessionRedisStorage.GLOBAL_KEY_PREFIX = '';
			} else if (RedisClientInstance.connectionOptions.REGULAR.prefix[RedisClientInstance.connectionOptions.REGULAR.prefix.length - 1] === ':') {
				UserSessionRedisStorage.GLOBAL_KEY_PREFIX = RedisClientInstance.connectionOptions.REGULAR.prefix;
			} else {
				UserSessionRedisStorage.GLOBAL_KEY_PREFIX = `${RedisClientInstance.connectionOptions.REGULAR.prefix}:`;
			}
		}

		await RedisClientInstance.subscriber.subscribe(`__keyspace@${RedisClientInstance.db}__:${UserSessionRedisStorage.GLOBAL_KEY_PREFIX}${sessionIdKey}`);
	}

	public async read(subject: Subject, sessionId: SessionId): Promise<MetaData | undefined> {
		const sessionBuffer = (await RedisClientInstance.client.get(this.sessionIdKeyBuffer(subject, sessionId) as unknown as string)) as unknown as Buffer;
		return sessionBuffer ? this.options.serializer.deserialize(sessionBuffer) : undefined;
	}

	public async readAll(subject: Subject): Promise<ReadonlyMap<SessionId, MetaData>> {
		const activeSessionIds = await RedisClientInstance.client.lrange(this.activeSessionsKey(subject), 0, -1);
		if (activeSessionIds.length === 0) {
			// mget command bellow expects at least one key, therefore we early return
			return UserSessionRedisStorage.NO_ACTIVE_SESSIONS;
		}

		const sessionIdKeysBuffers = new Array<Buffer>(activeSessionIds.length);
		for (let i = 0; i < activeSessionIds.length; i++) {
			sessionIdKeysBuffers[i] = this.sessionIdKeyBuffer(subject, activeSessionIds[i]);
		}

		const activeSessions = (await RedisClientInstance.client.mget(...(sessionIdKeysBuffers as unknown as string[]))) as (Buffer | null)[];

		const refreshTokenToActiveSessions = new Map<SessionId, MetaData>();

		for (let i = 0; i < activeSessions.length; i++) {
			if (activeSessions[i] == null) {
				continue;
			}
			refreshTokenToActiveSessions.set(activeSessionIds[i], this.options.serializer.deserialize(activeSessions[i]!));
		}

		return refreshTokenToActiveSessions;
	}

	public async delete(subject: Subject, sessionId: SessionId): Promise<void> {
		if ((await RedisClientInstance.client.del(this.sessionIdKey(subject, sessionId))) !== 1) {
			logger.warning(`Failed to delete session '${sessionId}' of the subject '${subject}'.`);
		}
		// auto remove from active sessions list via emitted 'del' event via PubSub
	}

	public async deleteAll(subject: Subject): Promise<number> {
		const activeSessionsKey = this.activeSessionsKey(subject);
		const activeSessionIds = await RedisClientInstance.client.lrange(activeSessionsKey, 0, -1);
		if (activeSessionIds.length === 0) {
			return 0;
		}

		for (let i = 0; i < activeSessionIds.length; i++) {
			activeSessionIds[i] = this.sessionIdKey(subject, activeSessionIds[i]);
		}

		const deletedSessionsNo = (await RedisClientInstance.client.del(activeSessionsKey, ...activeSessionIds)) - 1;
		if (deletedSessionsNo !== activeSessionIds.length) {
			logger.warning(
				`Failed to delete all sessions of the subject '${subject}'. Expected to delete ${activeSessionIds.length} sessions, but actually deleted ${deletedSessionsNo} sessions.`
			);
		}

		return deletedSessionsNo;
	}

	protected activeSessionsKey(subject: Subject): string {
		return `${this.options.keyPrefix.sessions}:${subject}`;
	}

	protected sessionIdKey(subject: Subject, sessionId: SessionId): string {
		return `${this.options.keyPrefix.sessionId}:${subject}:${sessionId}`;
	}

	protected sessionIdKeyBuffer(subject: Subject, sessionId: SessionId): Buffer {
		const buffer = Buffer.allocUnsafe(this.options.keyPrefix.sessionId.length + subject.length + sessionId.length + 2);
		buffer.write(this.options.keyPrefix.sessionId, 0, this.options.keyPrefix.sessionId.length);
		buffer.write(':', this.options.keyPrefix.sessionId.length, 1);
		buffer.write(subject, this.options.keyPrefix.sessionId.length + 1, subject.length);
		buffer.write(':', this.options.keyPrefix.sessionId.length + 1 + subject.length, 1);
		buffer.write(sessionId, this.options.keyPrefix.sessionId.length + subject.length + 2, sessionId.length);
		return buffer;
	}
}

export { UserSessionRedisStorage, type UserSessionRedisStorageOptions };
