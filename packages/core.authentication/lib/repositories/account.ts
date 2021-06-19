import { AccountRepository, AccountWithTotpSecret } from '@thermopylae/lib.authentication';
import type { UnixTimestamp } from '@thermopylae/core.declarations';
import { MySqlClientInstance, QueryType, ResultSetHeader, RowDataPacket } from '@thermopylae/core.mysql';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { TableNames } from './constants';
import { createException } from '../error';

class AccountMySqlRepository implements AccountRepository<AccountWithTotpSecret> {
	public async insert(account: AccountWithTotpSecret): Promise<void> {
		const connection = await MySqlClientInstance.getConnection(QueryType.WRITE);

		try {
			const [results] = await connection.execute<ResultSetHeader>(
				`INSERT INTO ${TableNames.Account} (username, passwordHash, passwordSalt, passwordAlg, email, telephone, disabledUntil, mfa, pubKey, totpSecret) VALUES (?, '${account.passwordHash}', ?, '${account.passwordAlg}', ?, ?, ${account.disabledUntil}, ${account.mfa}, ?, ?);`,
				[account.username, account.passwordSalt || null, account.email, account.telephone || null, account.pubKey || null, account.totpSecret]
			);

			account.id = String(results.insertId);
		} finally {
			connection.release();
		}
	}

	public async readById(accountId: string): Promise<AccountWithTotpSecret | null | undefined> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const [results] = await connection.query<RowDataPacket[]>(`SELECT * FROM ${TableNames.Account} WHERE id=${accountId};`);

			if (results.length !== 1) {
				return null;
			}

			results[0]['id'] = String(results[0]['id']);
			results[0]['mfa'] = results[0]['mfa'] === 1;

			return results[0] as AccountWithTotpSecret;
		} finally {
			connection.release();
		}
	}

	public async readByUsername(username: string): Promise<AccountWithTotpSecret | null | undefined> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const [results] = await connection.execute<RowDataPacket[]>(`SELECT * FROM ${TableNames.Account} WHERE username=?;`, [username]);

			if (results.length !== 1) {
				return null;
			}

			results[0]['id'] = String(results[0]['id']);
			results[0]['mfa'] = results[0]['mfa'] === 1;

			return results[0] as AccountWithTotpSecret;
		} finally {
			connection.release();
		}
	}

	public async readByEmail(email: string): Promise<AccountWithTotpSecret | null | undefined> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const [results] = await connection.execute<RowDataPacket[]>(`SELECT * FROM ${TableNames.Account} WHERE email=?;`, [email]);

			if (results.length !== 1) {
				return null;
			}

			results[0]['id'] = String(results[0]['id']);
			results[0]['mfa'] = results[0]['mfa'] === 1;

			return results[0] as AccountWithTotpSecret;
		} finally {
			connection.release();
		}
	}

	public async readByTelephone(telephone: string): Promise<AccountWithTotpSecret | null | undefined> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const [results] = await connection.execute<RowDataPacket[]>(`SELECT * FROM ${TableNames.Account} WHERE telephone=?;`, [telephone]);

			if (results.length !== 1) {
				return null;
			}

			results[0]['id'] = String(results[0]['id']);
			results[0]['mfa'] = results[0]['mfa'] === 1;

			return results[0] as AccountWithTotpSecret;
		} finally {
			connection.release();
		}
	}

	public async setDisabledUntil(accountId: string, until: UnixTimestamp): Promise<void> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const [results] = await connection.query<ResultSetHeader>(`UPDATE ${TableNames.Account} SET disabledUntil=${until} WHERE id=${accountId};`);

			if (results.affectedRows !== 1) {
				throw createException(ErrorCodes.NOT_FOUND, `Account with id '${accountId}' not found.`);
			}
		} finally {
			connection.release();
		}
	}

	public async update(accountId: string, update: Partial<AccountWithTotpSecret>): Promise<void> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const updatedProperties = Object.keys(update);
			for (let i = 0; i < updatedProperties.length; i++) {
				updatedProperties[i] = `${updatedProperties[i]}=?`;
			}

			const updatedValues = Object.values(update);
			updatedValues.push(accountId);

			const [results] = await connection.execute<ResultSetHeader>(
				`UPDATE ${TableNames.Account} SET ${updatedProperties.join(',')} WHERE id=?;`,
				updatedValues
			);

			if (results.affectedRows !== 1) {
				throw createException(ErrorCodes.NOT_FOUND, `Account with id '${accountId}' not found.`);
			}
		} finally {
			connection.release();
		}
	}

	public async changePassword(accountId: string, passwordHash: string, salt: string | undefined | null, hashingAlg: number): Promise<void> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const [results] = await connection.query<ResultSetHeader>(
				`UPDATE ${TableNames.Account} SET passwordHash='${passwordHash}', passwordSalt=?, passwordAlg=${hashingAlg} WHERE id=${accountId};`,
				[salt]
			);

			if (results.affectedRows !== 1) {
				throw createException(ErrorCodes.NOT_FOUND, `Account with id '${accountId}' not found.`);
			}
		} finally {
			connection.release();
		}
	}
}

export { AccountMySqlRepository };
