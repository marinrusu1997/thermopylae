import { ErrorCodes, Seconds } from '@thermopylae/core.declarations';
import { RedisClientInstance } from '@thermopylae/core.redis';
import { ForgotPasswordSessionRepository } from '@thermopylae/lib.authentication';
import { createException } from '../../error';

class ForgotPasswordSessionRedisRepository implements ForgotPasswordSessionRepository {
	private readonly prefix: string;

	public constructor(keyPrefix: string) {
		this.prefix = keyPrefix;
	}

	public async insert(token: string, ttl: Seconds): Promise<void> {
		const wasSet = await RedisClientInstance.client.set(`${this.prefix}:${token}`, '', ['EX', ttl], 'NX');
		if (wasSet == null) {
			throw createException(ErrorCodes.NOT_CREATED, 'Failed to insert forgot password session.');
		}
	}

	public async exists(token: string): Promise<boolean> {
		return (await RedisClientInstance.client.exists(`${this.prefix}:${token}`)) === 1;
	}

	public async delete(token: string): Promise<void> {
		await RedisClientInstance.client.del(`${this.prefix}:${token}`);
	}
}

export { ForgotPasswordSessionRedisRepository };
