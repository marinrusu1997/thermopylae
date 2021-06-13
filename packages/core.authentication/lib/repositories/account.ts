import { AccountRepository, AccountWithTotpSecret } from '@thermopylae/lib.authentication';
import type { UnixTimestamp } from '@thermopylae/core.declarations';
import { MySqlClientInstance, QueryType, ResultSetHeader } from '@thermopylae/core.mysql';
import { TableNames } from './constants';

class AccountMySqlRepository implements AccountRepository<AccountWithTotpSecret> {
	public async insert(account: AccountWithTotpSecret): Promise<void> {
		const connection = await MySqlClientInstance.getConnection(QueryType.WRITE);

		try {
			const [results] = await connection.query<ResultSetHeader>(
				`INSERT INTO ${TableNames.Account} (username, passwordHash, passwordSalt, passwordAlg, email, telephone, disabledUntil, mfa, pubKey, totpSecret) VALUES (?, '${account.passwordHash}', ?, '${account.passwordAlg}', ?, ?, ${account.disabledUntil}, ${account.mfa}, ?, ?);`,
				[account.username, account.passwordSalt, account.email, account.telephone, account.pubKey, account.totpSecret]
			);

			account.id = String(results.insertId);
		} finally {
			connection.release();
		}
	}

	changePassword(_accountId: string, _passwordHash: string, _salt: string | undefined, _hashingAlg: number): Promise<void> {
		return Promise.resolve(undefined);
	}

	readByEmail(_email: string): Promise<AccountWithTotpSecret | null | undefined> {
		return Promise.resolve(undefined);
	}

	readById(_accountId: string): Promise<AccountWithTotpSecret | null | undefined> {
		return Promise.resolve(undefined);
	}

	readByTelephone(_telephone: string): Promise<AccountWithTotpSecret | null | undefined> {
		return Promise.resolve(undefined);
	}

	readByUsername(_username: string): Promise<AccountWithTotpSecret | null | undefined> {
		return Promise.resolve(undefined);
	}

	setDisabledUntil(_accountId: string, _until: UnixTimestamp): Promise<void> {
		return Promise.resolve(undefined);
	}

	update(_accountId: string, _update: Partial<AccountWithTotpSecret>): Promise<void> {
		return Promise.resolve(undefined);
	}
}

export { AccountMySqlRepository };
