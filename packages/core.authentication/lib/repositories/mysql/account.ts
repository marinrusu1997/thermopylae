import type { AccountRepository, AccountWithTotpSecret } from '@thermopylae/lib.authentication';
import type { UnixTimestamp } from '@thermopylae/core.declarations';
import { MySqlClientInstance, QueryType, ResultSetHeader, RowDataPacket } from '@thermopylae/core.mysql';
import { TableNames } from '../constants';
import { createException, ErrorCodes } from '../../error';

class AccountMySqlRepository implements AccountRepository<AccountWithTotpSecret> {
	private static readonly DUPLICATED_FIELD_REGEXP = new RegExp(`for key '${TableNames.Account}\\.(username|email|telephone)'$`);

	private static readonly IS_DUPLICATE_EXISTS = {
		USERNAME: `EXISTS(SELECT * FROM ${TableNames.Account} WHERE username=?)`,
		EMAIL: `EXISTS(SELECT * FROM ${TableNames.Account} WHERE email=?)`,
		TELEPHONE: `EXISTS(SELECT * FROM ${TableNames.Account} WHERE telephone=?)`
	};

	private static readonly IS_DUPLICATE_SQL_QUERY = `SELECT ${AccountMySqlRepository.IS_DUPLICATE_EXISTS.USERNAME}, ${AccountMySqlRepository.IS_DUPLICATE_EXISTS.EMAIL}, ${AccountMySqlRepository.IS_DUPLICATE_EXISTS.TELEPHONE};`;

	private static readonly READ_BY_USERNAME_SQL_QUERY = `SELECT * FROM ${TableNames.Account} WHERE username=?;`;

	private static readonly READ_BY_EMAIL_SQL_QUERY = `SELECT * FROM ${TableNames.Account} WHERE email=?;`;

	private static readonly READ_BY_TELEPHONE_SQL_QUERY = `SELECT * FROM ${TableNames.Account} WHERE telephone=?;`;

	public async insert(account: AccountWithTotpSecret): Promise<(keyof AccountWithTotpSecret)[] | null | undefined> {
		const connection = await MySqlClientInstance.getConnection(QueryType.WRITE);

		try {
			const [results] = await connection.execute<ResultSetHeader>(
				`INSERT INTO ${TableNames.Account} (username, passwordHash, passwordSalt, passwordAlg, email, telephone, disabledUntil, mfa, pubKey, totpSecret) VALUES (?, '${account.passwordHash}', ?, '${account.passwordAlg}', ?, ?, ${account.disabledUntil}, ${account.mfa}, ?, ?);`,
				[account.username, account.passwordSalt || null, account.email, account.telephone || null, account.pubKey || null, account.totpSecret || null]
			);

			account.id = String(results.insertId);

			return null;
		} catch (e) {
			if (e.code === 'ER_DUP_ENTRY') {
				const match = AccountMySqlRepository.DUPLICATED_FIELD_REGEXP.exec(e.message);
				if (match != null && typeof match[1] === 'string') {
					return [match[1] as keyof AccountWithTotpSecret];
				}
			}

			throw e;
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
			const [results] = await connection.execute<RowDataPacket[]>(AccountMySqlRepository.READ_BY_USERNAME_SQL_QUERY, [username]);

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
			const [results] = await connection.execute<RowDataPacket[]>(AccountMySqlRepository.READ_BY_EMAIL_SQL_QUERY, [email]);

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
			const [results] = await connection.execute<RowDataPacket[]>(AccountMySqlRepository.READ_BY_TELEPHONE_SQL_QUERY, [telephone]);

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
				throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id '${accountId}' not found.`);
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
				throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id '${accountId}' not found.`);
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
				throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id '${accountId}' not found.`);
			}
		} finally {
			connection.release();
		}
	}

	public async isDuplicate(account: AccountWithTotpSecret): Promise<(keyof AccountWithTotpSecret)[] | null | undefined> {
		const connection = await MySqlClientInstance.getConnection(QueryType.READ);

		try {
			const [results] = await connection.execute<RowDataPacket[]>(AccountMySqlRepository.IS_DUPLICATE_SQL_QUERY, [
				account.username,
				account.email,
				account.telephone
			]);

			const duplicatedFields = new Array<keyof AccountWithTotpSecret>();

			// eslint-disable-next-line no-template-curly-in-string
			if (results[0][AccountMySqlRepository.IS_DUPLICATE_EXISTS.USERNAME] === 1) {
				duplicatedFields.push('username');
			}
			// eslint-disable-next-line no-template-curly-in-string
			if (results[0][AccountMySqlRepository.IS_DUPLICATE_EXISTS.EMAIL] === 1) {
				duplicatedFields.push('email');
			}
			// eslint-disable-next-line no-template-curly-in-string
			if (results[0][AccountMySqlRepository.IS_DUPLICATE_EXISTS.TELEPHONE] === 1) {
				duplicatedFields.push('telephone');
			}

			return duplicatedFields.length ? duplicatedFields : null;
		} finally {
			connection.release();
		}
	}
}

export { AccountMySqlRepository };
