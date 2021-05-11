import type { RefreshTokensStorage, UserSessionMetaData } from '@thermopylae/lib.jwt-session';
import type { HTTPRequestLocation, MutableSome } from '@thermopylae/core.declarations';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { ConnectionType, RedisClientInstance } from '@thermopylae/core.redis';
import type { JwtSessionDevice, UserSessionMetaDataSerializer } from '../../typings';
import { createException } from '../../error';
import { logger } from '../../logger';
import { JSON_SERIALIZER } from './json-serializer';
import { FAST_JSON_SERIALIZER } from './fast-json-serializer';
import { AVRO_SERIALIZER } from './avro-serializer';

interface RefreshTokensRedisStorageOptions {
	/**
	 * Prefixes used for keys stored in Redis.
	 */
	readonly keyPrefix: {
		/**
		 * Key prefix used for storing a list of refresh tokens belonging to a concrete subject. <br/>
		 * **Notice** that refresh tokens represent the user sessions and act as their ids,
		 * therefore we have a list of user session ids.
		 */
		readonly sessions: string;
		/**
		 * Key prefix used for storing refresh token as key and session metadata as value.
		 */
		readonly refreshToken: string;
	};
	/**
	 * Maximum number of concurrent sessions that a user can have. <br/>
	 * Creating a new session above this threshold will result in an error. <br/>
	 * When left *undefined*, user can have an unlimited number of sessions.
	 */
	readonly concurrentSessions?: number;
	/**
	 * Serializer used for session metadata serialization. <br/>
	 * Defaults to {@link RefreshTokensRedisStorage.SERIALIZERS.AVRO}.
	 */
	readonly serializer?: UserSessionMetaDataSerializer;
}

/**
 * Refresh tokens storage backed by [Redis](https://redis.io/). <br/>
 * This implementation uses *core.redis* as client and imposes the following requirements to him: <br/>
 * 	- {@link ConnectionType.SUBSCRIBER} connection needs to be established and available.
 * 		This is needed for receiving of key space notification events about refresh token keys deletion, expiration or eviction,
 * 		in order to remove them from list of active user sessions. <br/>
 * 	- {@link ConnectionType.REGULAR} connection needs to have **detect_buffers** option enabled, because it stores and reads
 * 		serialized user session metadata as {@link Buffer} instances. <br/>
 * 	- {@link RedisClientInstance.db} property should always return a valid db index.
 * 		It is recommended to not change db after {@link ConnectionType.REGULAR} connection was established.
 */
class RefreshTokensRedisStorage implements RefreshTokensStorage<JwtSessionDevice, HTTPRequestLocation> {
	private static readonly REDIS_OK_BUFFER_RESPONSE = Buffer.from('OK');

	private static readonly NO_ACTIVE_SESSIONS: ReadonlyMap<string, UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>> = new Map<
		string,
		UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>
	>();

	private readonly options: Required<RefreshTokensRedisStorageOptions>;

	/**
	 * Predefined serializers.
	 */
	public static readonly SERIALIZERS: Readonly<Record<'AVRO' | 'FAST-JSON' | 'JSON', UserSessionMetaDataSerializer>> = Object.freeze({
		/**
		 * Serializer which uses [AVRO format](https://avro.apache.org/docs/current/spec.html). <br/>
		 * Under the hood uses [avsc](https://www.npmjs.com/package/avsc) npm package.
		 */
		AVRO: AVRO_SERIALIZER,
		/**
		 * Serializer which uses under the hood
		 * [fast-json-stringify](https://www.npmjs.com/package/fast-json-stringify) npm package.
		 */
		'FAST-JSON': FAST_JSON_SERIALIZER,
		/**
		 * Serializer which uses native {@link JSON} serialization.
		 */
		JSON: JSON_SERIALIZER
	});

	public constructor(options: RefreshTokensRedisStorageOptions) {
		if (options.serializer == null) {
			(options as MutableSome<RefreshTokensRedisStorageOptions, 'serializer'>).serializer = RefreshTokensRedisStorage.SERIALIZERS.AVRO;
		}
		this.options = options as Required<RefreshTokensRedisStorageOptions>;

		RedisClientInstance.on(ConnectionType.SUBSCRIBER, 'message', (channel, message) => {
			if (!channel.startsWith('__keyspace@') || !(message === 'del' || message === 'expired' || message === 'evicted')) {
				return;
			}

			const [, prefix, subject, refreshToken] = channel.split(':');
			if (prefix !== this.options.keyPrefix.refreshToken) {
				return;
			}

			RedisClientInstance.subscriber.unsubscribe(channel).catch((e) => {
				logger.error(`Failed to unsubscribe from '${channel}' channel.`, e);
			});

			RedisClientInstance.client.lrem(this.activeSessionsKey(subject), 1, refreshToken).catch((e) => {
				logger.error(`Failed to remove '${refreshToken}' from the list of active sessions of the subject '${subject}'.`, e);
			});
		});
	}

	public async insert(
		subject: string,
		refreshToken: string,
		metaData: UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>,
		ttl: number
	): Promise<void> {
		const activeSessionsKey = this.activeSessionsKey(subject);

		if (this.options.concurrentSessions) {
			const activeSessions = await RedisClientInstance.client.llen(activeSessionsKey);
			if (activeSessions >= this.options.concurrentSessions) {
				throw createException(
					ErrorCodes.OVERFLOW,
					`Concurrent user sessions limit reached for subject '${subject}', as he has ${activeSessions} active sessions.`
				);
			}
		}

		const refreshTokenKey = this.refreshTokenKey(subject, refreshToken);

		const [wasSet, activeSessions] = ((await RedisClientInstance.client
			.multi()
			.set(refreshTokenKey, (this.options.serializer.serialize(metaData) as unknown) as string, ['EX', ttl], 'NX')
			.lpush(activeSessionsKey, refreshToken)
			.exec()) as unknown) as [Buffer, number];

		if (!wasSet.equals(RefreshTokensRedisStorage.REDIS_OK_BUFFER_RESPONSE)) {
			throw createException(ErrorCodes.NOT_CREATED, `Failed to insert user session under key '${refreshTokenKey}'.`);
		}

		logger.debug(`Inserted user session for subject '${subject}'. He has ${activeSessions} active sessions.`);

		await RedisClientInstance.subscriber.subscribe(`__keyspace@${RedisClientInstance.db}__:${refreshTokenKey}`);
	}

	public async read(subject: string, refreshToken: string): Promise<UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation> | undefined> {
		const sessionBuffer = ((await RedisClientInstance.client.get(
			(this.refreshTokenKeyBuffer(subject, refreshToken) as unknown) as string
		)) as unknown) as Buffer;
		return sessionBuffer ? this.options.serializer.deserialize(sessionBuffer) : undefined;
	}

	public async readAll(subject: string): Promise<ReadonlyMap<string, UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>>> {
		const refreshTokens = await RedisClientInstance.client.lrange(this.activeSessionsKey(subject), 0, -1);
		if (refreshTokens.length === 0) {
			// mget command bellow expects at least one key, therefore we early return
			return RefreshTokensRedisStorage.NO_ACTIVE_SESSIONS;
		}

		const refreshTokenKeysBuffers = new Array<Buffer>(refreshTokens.length);
		for (let i = 0; i < refreshTokens.length; i++) {
			refreshTokenKeysBuffers[i] = this.refreshTokenKeyBuffer(subject, refreshTokens[i]);
		}

		const activeSessions = (await RedisClientInstance.client.mget(...((refreshTokenKeysBuffers as unknown) as string[]))) as (Buffer | null)[];

		const refreshTokenToActiveSessions = new Map<string, UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>>();

		for (let i = 0; i < activeSessions.length; i++) {
			if (activeSessions[i] == null) {
				continue;
			}
			refreshTokenToActiveSessions.set(refreshTokens[i], this.options.serializer.deserialize(activeSessions[i]!));
		}

		return refreshTokenToActiveSessions;
	}

	public async delete(subject: string, refreshToken: string): Promise<void> {
		if ((await RedisClientInstance.client.del(this.refreshTokenKey(subject, refreshToken))) !== 1) {
			logger.warning(`Failed to delete session '${refreshToken}' of the subject '${subject}'.`);
		}
		// auto remove from active sessions list via emitted 'del' event via PubSub
	}

	public async deleteAll(subject: string): Promise<number> {
		const activeSessionKeys = await RedisClientInstance.client.lrange(this.activeSessionsKey(subject), 0, -1);
		if (activeSessionKeys.length === 0) {
			return 0;
		}

		for (let i = 0; i < activeSessionKeys.length; i++) {
			activeSessionKeys[i] = this.refreshTokenKey(subject, activeSessionKeys[i]);
		}

		// auto remove from active sessions list via emitted 'del' event via PubSub
		const deletedSessionsNo = await RedisClientInstance.client.del(...activeSessionKeys);
		if (deletedSessionsNo !== activeSessionKeys.length) {
			logger.warning(
				`Failed to delete all sessions of the subject '${subject}'. Expected to delete ${activeSessionKeys.length} sessions, but actually deleted ${deletedSessionsNo} sessions.`
			);
		}

		return deletedSessionsNo;
	}

	private activeSessionsKey(subject: string): string {
		return `${this.options.keyPrefix.sessions}:${subject}`;
	}

	private refreshTokenKey(subject: string, refreshToken: string): string {
		return `${this.options.keyPrefix.refreshToken}:${subject}:${refreshToken}`;
	}

	private refreshTokenKeyBuffer(subject: string, refreshToken: string): Buffer {
		const buffer = Buffer.allocUnsafe(this.options.keyPrefix.refreshToken.length + subject.length + refreshToken.length + 2);
		buffer.write(this.options.keyPrefix.refreshToken, 0, this.options.keyPrefix.refreshToken.length);
		buffer.write(':', this.options.keyPrefix.refreshToken.length, 1);
		buffer.write(subject, this.options.keyPrefix.refreshToken.length + 1, subject.length);
		buffer.write(':', this.options.keyPrefix.refreshToken.length + 1 + subject.length, 1);
		buffer.write(refreshToken, this.options.keyPrefix.refreshToken.length + subject.length + 2, refreshToken.length);
		return buffer;
	}
}

export { RefreshTokensRedisStorage, RefreshTokensRedisStorageOptions };
