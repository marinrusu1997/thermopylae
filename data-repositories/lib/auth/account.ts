import { token } from '@marin/lib.utils';
import { MySqlClientInstance, insertWithAssertion, updateWithAssertion, MysqlError, typeCastBooleans } from '@marin/lib.data-access';
import { entities, models } from '@marin/lib.auth-engine';

// FIXME replace multiline strings with concatenation for performance reasons

class AccountEntity implements entities.AccountEntity {
	public static readonly ACCOUNT_ID_LENGTH = 10;

	public static readonly EMAIL_CONTACT_CLASS = 'email';

	public static readonly TELEPHONE_CONTACT_CLASS = 'telephone';

	public static readonly CONTACT_TYPE_USED_BY_SYSTEM = 'primary';

	public create(account: models.AccountModel): Promise<string> {
		return new Promise((resolve, reject) => {
			MySqlClientInstance.writePool.getConnection((getConnErr, connection) => {
				if (getConnErr) {
					return reject(getConnErr);
				}

				connection.beginTransaction(async (beginTxErr) => {
					if (beginTxErr) {
						connection.release();
						return reject(beginTxErr);
					}

					function generateRollbackHandler(originErr: Error) {
						return function handleRollback(rollbackErr: MysqlError): void {
							connection.release();

							const rejectionError = rollbackErr ? { rollbackErr, originErr } : originErr;
							reject(rejectionError);
						};
					}

					function generateCommitHandler(accountId: string) {
						return function handleCommit(commitErr: MysqlError): void {
							if (commitErr) {
								return connection.rollback(generateRollbackHandler(commitErr));
							}

							connection.release();
							return resolve(accountId);
						};
					}

					try {
						const accountId = (await token.generate(AccountEntity.ACCOUNT_ID_LENGTH)).plain;

						const insertUserSQL = `
												INSERT INTO User (ID, RelatedAccountID, RelatedRoleID)
												SELECT '${accountId}', NULL, ID 
												FROM Role 
												WHERE Name = ${connection.escape(account.role!)};
											  `;
						await insertWithAssertion(connection, insertUserSQL, undefined, 'Failed to INSERT User');

						const insertAccountSQL = `INSERT INTO Account (ID, Enabled) VALUES ('${accountId}', ?);`;
						await insertWithAssertion(connection, insertAccountSQL, account.enabled, 'Failed to INSERT Account');

						const updateUserSQL = `
												UPDATE User 
												SET RelatedAccountID = '${accountId}' 
												WHERE ID = '${accountId}';
											  `;
						await updateWithAssertion(connection, updateUserSQL, undefined, 'Failed to UPDATE User');

						const insertAuthenticationSQL = `INSERT INTO Authentication (ID, UserName, PasswordHash, PasswordSalt, MultiFactor)
														  VALUES ('${accountId}', ?, ?, ?, ?);`;
						await insertWithAssertion(
							connection,
							insertAuthenticationSQL,
							[account.username, account.password, account.salt, account.usingMfa],
							'Failed to INSERT Authentication'
						);

						const insertContactsSQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
													('${AccountEntity.EMAIL_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${accountId}'),
													('${AccountEntity.TELEPHONE_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${accountId}');`;
						await insertWithAssertion(connection, insertContactsSQL, [account.email, account.telephone], 'Failed to INSERT Contacts', 2);

						connection.commit(generateCommitHandler(accountId));
					} catch (errOccurredWhileRunningTx) {
						connection.rollback(generateRollbackHandler(errOccurredWhileRunningTx));
					}

					return undefined;
				});

				return undefined;
			});
		});
	}

	public read(username: string): Promise<models.AccountModel | null> {
		return doAccountRead('username', username);
	}

	public readById(accountId: string): Promise<models.AccountModel | null> {
		return doAccountRead('id', accountId);
	}

	public changePassword(accountId: string, passwordHash: string, salt: string): Promise<void> {
		return new Promise((resolve, reject) => {
			// not escaped, trusted source of data, if we escape these, it could cause account loss,
			// as the right password will never match with the escaped hash
			const updateAuthenticationSQL = `UPDATE Authentication
												SET PasswordHash = '${passwordHash}', 
													PasswordSalt = '${salt}'
												WHERE ID = '${accountId}';`;
			MySqlClientInstance.writePool.query(updateAuthenticationSQL, (err, results) => {
				if (err) {
					return reject(err);
				}
				if (results.changedRows !== 1) {
					return reject(new Error(`Failed to change password and salt for account id ${accountId} . No changes occurred. `));
				}
				return resolve();
			});
		});
	}

	public enable(accountId: string): Promise<void> {
		return doChangeAccountEnabledStatus(accountId, true);
	}

	public disable(accountId: string): Promise<void> {
		return doChangeAccountEnabledStatus(accountId, false);
	}

	public enableMultiFactorAuth(accountId: string): Promise<void> {
		return doChangeMultiFactorAuthenticationEnabledStatus(accountId, true);
	}

	public disableMultiFactorAuth(accountId: string): Promise<void> {
		return doChangeMultiFactorAuthenticationEnabledStatus(accountId, false);
	}

	public delete(accountId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const deleteAccountSQL = `DELETE FROM Account WHERE ID = ?;`;
			MySqlClientInstance.writePool.query(deleteAccountSQL, accountId, (err, results) => {
				if (err) {
					return reject(err);
				}
				if (results.affectedRows !== 1) {
					return reject(new Error(`Failed to delete account with id ${accountId}. No affected rows. `));
				}
				return resolve();
			});
		});
	}
}

function doAccountRead(by: string, valueOfBy: string): Promise<models.AccountModel | null> {
	return new Promise((resolve, reject) => {
		const selectAccountSQL = `
					SELECT 	Account.ID as id,
							Authentication.UserName as username,
							Authentication.PasswordHash as password,
							Authentication.PasswordSalt as salt,
							Contact.Class as contactClass,
							Contact.Contact as contact,
							Account.Enabled as enabled,
							Authentication.MultiFactor as usingMfa,
							Role.Name as role
					FROM \`User\`
						INNER JOIN Contact 			ON User.ID 					= Contact.RelatedUserID
						INNER JOIN Role 			ON Role.ID 					= User.RelatedRoleID
						INNER JOIN Account			ON Account.ID 				= User.RelatedAccountID
						INNER JOIN Authentication 	ON User.RelatedAccountID 	= Authentication.ID
					WHERE
						Authentication.${by === 'id' ? 'ID' : 'UserName'} = ? AND
						Account.ID = User.ID AND -- we are retrieving only the user who created the account
						Contact.Type = '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}';
				`;
		const query = {
			sql: selectAccountSQL,
			values: valueOfBy,
			typeCast: typeCastBooleans
		};
		MySqlClientInstance.readPool.query(query, (err, result) => {
			if (err) {
				return reject(err);
			}

			if (result.length !== 2) {
				return resolve(null);
			}

			if (result[0].contactClass === AccountEntity.EMAIL_CONTACT_CLASS) {
				result[0].email = result[0].contact;
				result[0].telephone = result[1].contact;
			} else {
				result[0].telephone = result[0].contact;
				result[0].email = result[1].contact;
			}

			delete result[0].contactClass;
			delete result[0].contact;

			return resolve(result[0]);
		});
	});
}

function doChangeAccountEnabledStatus(accountId: string, isEnabled: boolean): Promise<void> {
	return new Promise((resolve, reject) => {
		const updateAccountSQL = `UPDATE Account SET Enabled = ${isEnabled} WHERE ID = ?;`;
		MySqlClientInstance.writePool.query(updateAccountSQL, accountId, (err, results) => {
			if (err) {
				return reject(err);
			}
			if (results.changedRows !== 1) {
				return reject(new Error(`Failed to update enabled status for account id ${accountId} to ${isEnabled}. No changes occurred. `));
			}
			return resolve();
		});
	});
}

function doChangeMultiFactorAuthenticationEnabledStatus(accountId: string, isEnabled: boolean): Promise<void> {
	return new Promise((resolve, reject) => {
		const updateAuthenticationSQL = `UPDATE Authentication SET MultiFactor = ${isEnabled} WHERE ID = ?;`;
		MySqlClientInstance.writePool.query(updateAuthenticationSQL, accountId, (err, results) => {
			if (err) {
				return reject(err);
			}
			if (results.changedRows !== 1) {
				return reject(
					new Error(`Failed to update multi factor authentication enabled status for account id ${accountId} to ${isEnabled}. No changes occurred. `)
				);
			}
			return resolve();
		});
	});
}

export { AccountEntity };
