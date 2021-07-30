import { Seconds } from '@thermopylae/core.declarations';
import { RedisClientInstance } from '@thermopylae/core.redis';
import type { AccountWithTotpSecret, ActivateAccountSessionRepository } from '@thermopylae/lib.authentication';
import { createException, ErrorCodes } from '../../error';

class ActivateAccountSessionRedisRepository implements ActivateAccountSessionRepository<AccountWithTotpSecret> {
	private readonly prefix: string;

	public constructor(keyPrefix: string) {
		this.prefix = keyPrefix;
	}

	public async insert(token: string, account: AccountWithTotpSecret, ttl: Seconds): Promise<void> {
		const wasSet = await RedisClientInstance.client.set(`${this.prefix}:${token}`, JSON.stringify(account), ['EX', ttl], 'NX');
		if (wasSet == null) {
			throw createException(
				ErrorCodes.ACTIVATE_ACCOUNT_SESSION_NOT_CREATED,
				`Failed to insert activate account session for account with username '${account.username}' and email '${account.email}'.`
			);
		}
	}

	public async read(token: string): Promise<AccountWithTotpSecret | null | undefined> {
		const account = await RedisClientInstance.client.get(`${this.prefix}:${token}`);
		if (account != null) {
			return JSON.parse(account) as AccountWithTotpSecret;
		}
		return account;
	}

	public async delete(token: string): Promise<void> {
		await RedisClientInstance.client.del(`${this.prefix}:${token}`);
	}
}

export { ActivateAccountSessionRedisRepository };
