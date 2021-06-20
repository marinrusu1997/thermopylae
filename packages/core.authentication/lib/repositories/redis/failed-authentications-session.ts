import { ErrorCodes, Seconds } from '@thermopylae/core.declarations';
import { RedisClientInstance } from '@thermopylae/core.redis';
import { FailedAuthAttemptSessionRepository } from '@thermopylae/lib.authentication';
import { FailedAuthenticationAttemptSession } from '@thermopylae/lib.authentication/lib';
import { createException } from '../../error';

class FailedAuthenticationAttemptsSessionRedisRepository implements FailedAuthAttemptSessionRepository {
	private readonly prefix: string;

	public constructor(keyPrefix: string) {
		this.prefix = keyPrefix;
	}

	public async upsert(username: string, session: FailedAuthenticationAttemptSession, ttl: Seconds): Promise<void> {
		const wasSet = await RedisClientInstance.client.set(`${this.prefix}:${username}`, JSON.stringify(session), ['EX', ttl]);
		if (wasSet == null) {
			throw createException(ErrorCodes.NOT_CREATED, `Failed to insert failed authentication attempts session for username '${username}'.`);
		}
	}

	public async read(username: string): Promise<FailedAuthenticationAttemptSession | null | undefined> {
		const session = await RedisClientInstance.client.get(`${this.prefix}:${username}`);
		if (session != null) {
			return JSON.parse(session) as FailedAuthenticationAttemptSession;
		}
		return session;
	}

	public async delete(username: string): Promise<void> {
		await RedisClientInstance.client.del(`${this.prefix}:${username}`);
	}
}

export { FailedAuthenticationAttemptsSessionRedisRepository };
