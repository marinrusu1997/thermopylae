import { entities, models } from '@marin/lib.auth-engine';
import { token } from '@marin/lib.utils';
import { MySqlClientInstance, typeCastBooleans } from '../clients/mysql';

type Seconds = number;

interface GenerateEntityOptions {
	'table-name'?: string;
	'auto-generated-key'?: boolean;
	'cache-key-prefix'?: string;
	'cache-ttl'?: Seconds;
}

class AuthRepository {
	public static generateAccountEntity(options: GenerateEntityOptions): entities.AccountEntity {
		options['table-name'] = options['table-name'] || 'account';

		function changeAccountLockStatus(id: string, locked: boolean): Promise<void> {
			return new Promise<void>((resolve, reject) => {
				const updateSQL = `UPDATE ${options['table-name']} SET locked = ${locked} WHERE id = ?;`;
				MySqlClientInstance.writePool.query(updateSQL, id, (err, results) => {
					if (err) {
						return reject(err);
					}
					if (results.changedRows !== 1) {
						return reject(new Error(`Failed to update lock status for account id ${id}. No changes occurred.`));
					}
					return resolve();
				});
			});
		}

		function doReadSingleAccount(sql: string, values: Array<any> | any, resolve: Function, reject: Function): void {
			MySqlClientInstance.readPool.query(
				{
					sql,
					values,
					typeCast: typeCastBooleans
				},
				(err, result) => {
					if (err) {
						return reject(err);
					}
					if (result.length !== 1) {
						return resolve(null); // not found
					}
					result[0].id = String(result[0].id); // convert to string if is auto-generated
					return resolve(result[0]);
				}
			);
		}

		return {
			async create(account: models.AccountModel): Promise<models.AccountModel> {
				if (!account.id && !options['auto-generated-key']) {
					account.id = (await token.generate(10)).plain;
				}

				return new Promise<models.AccountModel>((resolve, reject) => {
					let columnsSQL = '(username, password, salt, telephone, email, locked, activated, mfa';
					let valuesSQL = '(?, ?, ?, ?, ?, ?, ?, ?';
					const values: Array<boolean | number | string | Buffer> = [
						account.username,
						account.password,
						account.salt,
						account.telephone,
						account.email,
						account.locked,
						account.activated,
						account.mfa
					];

					function addMissingComponentsToSqlQuery(column: string, value: any): void {
						columnsSQL += `, ${column}`;
						valuesSQL += ', ?';
						values.push(value);
					}

					if (account.role) {
						addMissingComponentsToSqlQuery('role', account.role);
					}
					if (account.pubKey) {
						addMissingComponentsToSqlQuery('pubKey', account.pubKey);
					}
					if (!options['auto-generated-key']) {
						addMissingComponentsToSqlQuery('id', account.id);
					}

					columnsSQL += ')';
					valuesSQL += ')';

					const insertSQL = `INSERT INTO ${options['table-name']} ${columnsSQL} VALUES ${valuesSQL};`;
					MySqlClientInstance.writePool.query(insertSQL, values, (err, results) => {
						if (err) {
							return reject(err);
						}
						account.id = String(account.id || results.insertId); // convert to string if is auto-generated
						return resolve(account);
					});
				});
			},
			read(username: string): Promise<models.AccountModel | null> {
				return new Promise<models.AccountModel | null>((resolve, reject) => {
					const selectSQL = `SELECT * FROM ${options['table-name']} WHERE username = ?;`;
					doReadSingleAccount(selectSQL, username, resolve, reject);
				});
			},
			readById(id: string): Promise<models.AccountModel | null> {
				return new Promise<models.AccountModel | null>((resolve, reject) => {
					const selectSQL = `SELECT * FROM ${options['table-name']} WHERE id = ?;`;
					doReadSingleAccount(selectSQL, id, resolve, reject);
				});
			},
			lock(id: string): Promise<void> {
				return changeAccountLockStatus(id, true);
			},
			unlock(id: string): Promise<void> {
				return changeAccountLockStatus(id, false);
			},
			activate(id: string): Promise<void> {
				return new Promise<void>((resolve, reject) => {
					const updateSQL = `UPDATE ${options['table-name']} SET activated = true WHERE id = ?;`;
					MySqlClientInstance.writePool.query(updateSQL, id, (err, results) => {
						if (err) {
							return reject(err);
						}
						if (results.changedRows !== 1) {
							return reject(new Error(`Failed to change activated status for account id ${id}. No changes occurred.`));
						}
						return resolve();
					});
				});
			},
			changePassword(id: string, password: string, salt: string): Promise<void> {
				return new Promise<void>((resolve, reject) => {
					const updateSQL = `UPDATE ${options['table-name']} SET password = ?, salt = ? WHERE id = ?;`;
					MySqlClientInstance.writePool.query(updateSQL, [password, salt, id], (err, results) => {
						if (err) {
							return reject(err);
						}
						if (results.changedRows !== 1) {
							return reject(new Error(`Failed to change password for account id ${id}. No changes occurred.`));
						}
						return resolve();
					});
				});
			},
			enableMFA(id: string, enabled: boolean): Promise<void> {
				return new Promise<void>((resolve, reject) => {
					const updateSQL = `UPDATE ${options['table-name']} SET mfa = ? WHERE id = ?;`;
					MySqlClientInstance.writePool.query(updateSQL, [enabled, id], (err, results) => {
						if (err) {
							return reject(err);
						}
						if (results.changedRows !== 1) {
							return reject(new Error(`Failed to change mfa status for account id ${id}. No changes occurred.`));
						}
						return resolve();
					});
				});
			},
			delete(id: string): Promise<void> {
				return new Promise<void>((resolve, reject) => {
					const deleteSQL = `DELETE FROM ${options['table-name']} WHERE id = ?;`;
					MySqlClientInstance.writePool.query(deleteSQL, id, (err, results) => {
						if (err) {
							return reject(err);
						}
						if (results.affectedRows !== 1) {
							return reject(new Error(`Failed to delete account with id ${id}. No affected rows.`));
						}
						return resolve();
					});
				});
			}
		};
	}
}

export { AuthRepository, GenerateEntityOptions, Seconds };
