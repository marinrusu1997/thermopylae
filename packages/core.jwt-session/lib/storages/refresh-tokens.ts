import type { RefreshTokensStorage, UserSessionMetaData } from '@thermopylae/lib.jwt-session';
import type { HTTPRequestLocation } from '@thermopylae/core.declarations';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { ConnectionType, RedisClientInstance } from '@thermopylae/core.redis';
import type { JwtSessionDevice } from '../typings';
import { createException } from '../error';
import { logger } from '../logger';

interface RefreshTokensRedisStorageOptions {
	readonly keyPrefix: {
		sessions: string;
		refreshToken: string;
	};
	readonly concurrentSessions?: number;
	// @fixme use `detect_buffer` and avsc as default, also separate config for redis clients
	// https://www.npmjs.com/package/avsc
	// https://github.com/fastify/fast-json-stringify
	readonly serializer?: {
		serialize(session: UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>): Buffer;
		deserialize(buffer: Buffer): UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>;
	};
}

class RefreshTokensRedisStorage implements RefreshTokensStorage<JwtSessionDevice, HTTPRequestLocation> {
	private readonly options: RefreshTokensRedisStorageOptions;

	public constructor(options: RefreshTokensRedisStorageOptions) {
		this.options = options;

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

			RedisClientInstance.client
				.lrem(this.activeSessionsKey(subject), 1, refreshToken)
				.then((count) => {
					if (count !== 1) {
						logger.warning(
							`Failed to remove '${refreshToken}' from the list of active sessions of the subject '${subject}'. Received delete count: ${count}.`
						);
					}
				})
				.catch((e) => {
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
		const metaDataString = JSON.stringify(metaData);

		const [wasSet, activeSessions] = await RedisClientInstance.client
			.multi()
			.set(refreshTokenKey, metaDataString, ['EX', ttl], 'NX')
			.lpush(activeSessionsKey, refreshToken)
			.exec();
		if (wasSet !== 'OK') {
			throw createException(ErrorCodes.NOT_CREATED, `Failed to insert user session under key '${refreshTokenKey}'.`);
		}

		logger.debug(`Inserted user session for subject '${subject}'. He has ${activeSessions} active sessions.`);

		await RedisClientInstance.subscriber.subscribe(`__keyspace@${RedisClientInstance.db}__:${refreshTokenKey}`);
	}

	public async read(subject: string, refreshToken: string): Promise<UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation> | undefined> {
		const session = await RedisClientInstance.client.get(this.refreshTokenKey(subject, refreshToken));
		return session ? JSON.parse(session) : undefined;
	}

	public async readAll(subject: string): Promise<UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>[]> {
		const activeSessionKeys = await RedisClientInstance.client.lrange(this.activeSessionsKey(subject), 0, -1);
		if (activeSessionKeys.length === 0) {
			// mget command bellow expects at least one key, therefore we early return
			return (activeSessionKeys as unknown) as UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>[];
		}

		for (let i = 0; i < activeSessionKeys.length; i++) {
			activeSessionKeys[i] = this.refreshTokenKey(subject, activeSessionKeys[i]);
		}

		const activeSessions = (await RedisClientInstance.client.mget(...activeSessionKeys)) as (
			| UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>
			| string
			| null
		)[];

		for (let i = activeSessions.length - 1; i >= 0; i--) {
			if (activeSessions[i] == null) {
				activeSessions.splice(i, 1);
				continue;
			}
			activeSessions[i] = JSON.parse(activeSessions[i] as string);
		}

		return activeSessions as UserSessionMetaData<JwtSessionDevice, HTTPRequestLocation>[];
	}

	public async delete(subject: string, refreshToken: string): Promise<void> {
		if ((await RedisClientInstance.client.del(this.refreshTokenKey(subject, refreshToken))) !== 1) {
			logger.warning(`Failed to delete session '${refreshToken}' of the subject '${subject}'.`);
		}
		// auto remove from active sessions list via emitted 'del' event via PubSub
	}

	public async deleteAll(subject: string): Promise<number> {
		const activeSessionKeys = await RedisClientInstance.client.lrange(this.activeSessionsKey(subject), 0, -1);
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
}

export { RefreshTokensRedisStorage, RefreshTokensRedisStorageOptions };
