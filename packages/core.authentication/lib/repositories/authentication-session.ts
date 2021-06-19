import { AuthenticationSession, AuthenticationSessionRepository } from '@thermopylae/lib.authentication';
import { ErrorCodes, Seconds } from '@thermopylae/core.declarations';
import { RedisClientInstance } from '@thermopylae/core.redis';
import { createException } from '../error';

class AuthenticationSessionRedisRepository implements AuthenticationSessionRepository {
	private readonly prefix: string;

	public constructor(keyPrefix: string) {
		this.prefix = keyPrefix;
	}

	public async upsert(username: string, deviceId: string, session: AuthenticationSession, ttl: Seconds): Promise<void> {
		const wasSet = await RedisClientInstance.client.set(this.buildKey(username, deviceId), JSON.stringify(session), ['EX', ttl]);
		if (wasSet == null) {
			throw createException(ErrorCodes.NOT_CREATED, `Failed to insert authentication session for username '${username}' and device id '${deviceId}'.`);
		}
	}

	public async read(username: string, deviceId: string): Promise<AuthenticationSession | null | undefined> {
		const session = await RedisClientInstance.client.get(this.buildKey(username, deviceId));
		if (session != null) {
			return JSON.parse(session) as AuthenticationSession;
		}
		return session;
	}

	public async delete(username: string, deviceId: string): Promise<void> {
		await RedisClientInstance.client.del(this.buildKey(username, deviceId));
	}

	private buildKey(username: string, deviceId: string): string {
		return `${this.prefix}:${username}:${deviceId}`;
	}
}

export { AuthenticationSessionRedisRepository };
