import type { Seconds } from '@thermopylae/core.declarations';
import { RedisClientInstance } from '@thermopylae/core.redis';
import type { AccountWithTotpSecret, ActivateAccountSessionRepository } from '@thermopylae/lib.authentication';
import { type encryption, json } from '@thermopylae/lib.utils';
import { ErrorCodes, createException } from '../../error.js';

class ActivateAccountSessionRedisRepository implements ActivateAccountSessionRepository<AccountWithTotpSecret> {
	private readonly prefix: string;

	private readonly encryption: encryption.FastSymmetricEncryption;

	public constructor(keyPrefix: string, encryption: encryption.FastSymmetricEncryption) {
		this.prefix = keyPrefix;
		this.encryption = encryption;
	}

	public async insert(token: string, account: AccountWithTotpSecret, ttl: Seconds): Promise<void> {
		const wasSet = await RedisClientInstance.client.set(
			`${this.prefix}:${token}`,
			JSON.stringify(this.encryption.encrypt(JSON.stringify(account))),
			['EX', ttl],
			'NX'
		);
		if (wasSet == null) {
			throw createException(
				ErrorCodes.ACTIVATE_ACCOUNT_SESSION_NOT_CREATED,
				`Failed to insert activate account session for account with username '${account.username}' and email '${account.email}'.`
			);
		}
	}

	public async read(token: string): Promise<AccountWithTotpSecret | null | undefined> {
		const payload = await RedisClientInstance.client.get(`${this.prefix}:${token}`);
		if (payload != null) {
			const parsed = json.TypedJson.parse<encryption.FastSymmetricEncryptedPayload>(payload);
			const decrypted = this.encryption.decrypt(parsed);
			return json.TypedJson.parse<AccountWithTotpSecret>(decrypted);
		}
		return payload;
	}

	public async delete(token: string): Promise<void> {
		await RedisClientInstance.client.del(`${this.prefix}:${token}`);
	}
}

export { ActivateAccountSessionRedisRepository };
