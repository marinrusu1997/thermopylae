import { token } from '@marin/lib.utils';
import { MySqlClientInstance, queryAsync, MysqlError } from '@marin/lib.data-access';
import { entities, models } from '@marin/lib.auth-engine';

class AccountEntity implements entities.AccountEntity {
	create(account: models.AccountModel): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			MySqlClientInstance.writePool.getConnection((getConnErr, connection) => {
				if (getConnErr) {
					return reject(getConnErr);
				}

				connection.beginTransaction(async (beginTxErr) => {
					if (beginTxErr) {
						connection.release();
						return reject(beginTxErr);
					}

					let accountId: string;

					function generateRollbackHandler(originErr: Error) {
						return function handleRollback(rollbackErr: MysqlError): void {
							connection.release();

							const rejectionError = rollbackErr ? { rollbackErr, originErr } : originErr;
							reject(rejectionError);
						};
					}

					function handleCommit(commitErr: MysqlError): void {
						if (commitErr) {
							return connection.rollback(generateRollbackHandler(commitErr));
						}

						connection.release();
						return resolve(accountId);
					}

					try {
						accountId = (await token.generate(10)).plain;

						const insertUserSQL = `INSERT INTO User (ID, RelatedAccountID, RelatedRoleID)
												SELECT ${accountId}, ${accountId}, ID FROM Role WHERE Name = ${connection.escape(account.role!)};`;
						await queryAsync(connection, insertUserSQL);

						const insertAccountSQL = `INSERT INTO Account (ID, Enabled) VALUES (${accountId}, ?);`;
						await queryAsync(connection, insertAccountSQL, account.enabled);

						const insertAuthenticationSQL = `INSERT INTO Authentication (ID, UserName, PasswordHash, PasswordSalt, MultiFactor)
														  VALUES (${accountId}, ?, ?, ?, ?);`;
						await queryAsync(connection, insertAuthenticationSQL, [account.username, account.password, account.salt, account.usingMfa]);

						const insertContactsSQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
													('email', 'primary', ?, ${accountId}),
													('telephone', 'primary', ?, ${accountId});`;
						await queryAsync(connection, insertContactsSQL, [account.email, account.telephone]);

						connection.commit(handleCommit);
					} catch (errOccurredWhileRunningTx) {
						connection.rollback(generateRollbackHandler(errOccurredWhileRunningTx));
					}

					return undefined;
				});

				return undefined;
			});
		});
	}

	read(username: string): Promise<models.AccountModel | null> {
		// join Authentication, Account, User, Contact
	}

	readById(id: string): Promise<models.AccountModel | null> {
		return undefined;
	}

	changePassword(id: string, passwordHash: string, salt: string): Promise<void> {
		return undefined;
	}

	disable(id: string): Promise<void> {
		return undefined;
	}

	enable(id: string): Promise<void> {
		return undefined;
	}

	disableMultiFactorAuth(id: string): Promise<void> {
		return undefined;
	}

	enableMultiFactorAuth(id: string): Promise<void> {
		return undefined;
	}

	delete(id: string): Promise<void> {
		return undefined;
	}
}
