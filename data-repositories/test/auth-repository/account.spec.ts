import { string } from '@marin/lib.utils';
import { models } from '@marin/lib.auth-engine';
import { insertWithAssertion, MySqlClientInstance, queryAsync } from '@marin/lib.data-access';

import { describe, it, before, afterEach } from 'mocha';
import { expect } from 'chai';
import { truncateAllTables, brokeConnectionWithMySql, reconnectToMySql, MySqlEnv } from '../setup';

import { AuthRepository } from '../../lib';
import { AccountEntity } from '../../lib/auth/account';

describe('account spec', () => {
	const USER_ROLE = 'USER';
	const MODERATOR_ROLE = 'MODERATOR';

	before(function (done) {
		this.timeout(15000);

		truncateAllTables(async (err: Error) => {
			if (err) {
				return done(err);
			}

			try {
				await insertWithAssertion(MySqlClientInstance.writePool, `INSERT INTO Role (Name) VALUES ('${USER_ROLE}');`);
				await insertWithAssertion(MySqlClientInstance.writePool, `INSERT INTO Role (Name) VALUES ('${MODERATOR_ROLE}');`);

				return done();
			} catch (insertErr) {
				return done(insertErr);
			}
		});
	});

	afterEach((done) => MySqlClientInstance.writePool.query('DELETE FROM Account;', done));

	describe('create spec', () => {
		it('creates multiple users', async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: USER_ROLE
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			account.username = 'username2';
			account.role = MODERATOR_ROLE;
			account.usingMfa = false;
			account.enabled = false;
			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);
		});

		it('after account is created, new users can be added to the same account', async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: USER_ROLE
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			const insertUserSQL = `INSERT INTO User (ID, RelatedAccountID, RelatedRoleID) SELECT 'true random', '${account.id}', ID FROM Role WHERE Name = '${MODERATOR_ROLE}';`;
			await insertWithAssertion(MySqlClientInstance.writePool, insertUserSQL);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM User;')).results[0].row_count).to.be.eq(2);
		});

		it("rollback's transaction if something goes wrong", async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: USER_ROLE
			};
			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			account.username = 'username2';
			account.email = string.generateStringOfLength(256);
			account.usingMfa = false;
			account.enabled = false;
			account.role = MODERATOR_ROLE;

			let insertContactError;
			try {
				account.id = await AuthRepository.accountEntity.create(account);
			} catch (e) {
				insertContactError = e;
			}
			expect(insertContactError).to.haveOwnProperty('message', "ER_DATA_TOO_LONG: Data too long for column 'Contact' at row 1");

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM User;')).results[0].row_count).to.be.eq(1);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Account;')).results[0].row_count).to.be.eq(1);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Authentication;')).results[0].row_count).to.be.eq(1);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Contact;')).results[0].row_count).to.be.eq(2);
		}).timeout(3000);

		it('fails to create account if network or transport error is encountered', async () => {
			const account: models.AccountModel = {
				username: 'username',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: USER_ROLE
			};

			await brokeConnectionWithMySql();

			let connectionError: Error;
			try {
				account.id = await AuthRepository.accountEntity.create(account);
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlEnv.host}:${MySqlEnv.port}`
			]);

			await reconnectToMySql();
		}).timeout(30000);

		it('fails to create accounts with the same username', async () => {
			const account: models.AccountModel = {
				username: 'username',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: USER_ROLE
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			account.usingMfa = false;
			account.enabled = false;

			let duplicateErr;
			try {
				account.id = await AuthRepository.accountEntity.create(account);
			} catch (e) {
				duplicateErr = e;
			}
			expect(duplicateErr).to.haveOwnProperty('message', "ER_DUP_ENTRY: Duplicate entry 'username' for key 'Authentication.UserName'");
		});

		it('fails to create with a role which does not exist', async () => {
			let err;
			try {
				const account: models.AccountModel = {
					username: 'username',
					password: 'password',
					salt: 'salt',
					telephone: 'telephone',
					email: 'email',
					usingMfa: true,
					enabled: true,
					role: 'invalid role for sure'
				};
				account.id = await AuthRepository.accountEntity.create(account);
			} catch (e) {
				err = e;
			}

			expect(err).to.haveOwnProperty('message', 'Failed to INSERT User');
		});
	});

	/*	describe('read by username', () => {
		it('reads an existing account', async () => {
			const account = await AccountEntity.create({
				username: 'username',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				mfa: true,
				activated: true,
				locked: true,
				role: 'ADMIN',
				pubKey: 'pubKey'
			});

			expect(account.id).to.be.a('string');
			expect(await AccountEntity.read(account.username)).to.be.deep.eq(account);
		});

		it('returns null when account does not exist', async () => {
			const account = await AccountEntity.read(string.generateStringOfLength(5));
			expect(account).to.be.eq(null);
		});

		it('throws when an error at query level occurs', async () => {
			await shutdownMySqlClient();

			let err;
			try {
				await AccountEntity.read(string.generateStringOfLength(5));
			} catch (e) {
				err = e;
			}
			expect(err).to.not.be.eq(undefined);
		});
	});

	describe('read by id', () => {
		it('reads an existing account', async () => {
			const account = await AccountEntity.create({
				username: 'username',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				mfa: true,
				activated: true,
				locked: true,
				role: 'ADMIN',
				pubKey: 'pubKey'
			});

			expect(account.id).to.be.a('string');
			expect(await AccountEntity.readById(account.id!)).to.be.deep.eq(account);
		});

		it('returns null when account does not exist', async () => {
			const account = await AccountEntity.readById(string.generateStringOfLength(5));
			expect(account).to.be.eq(null);
		});

		it('throws when an error at query level occurs', async () => {
			await shutdownMySqlClient();

			let err;
			try {
				await AccountEntity.readById(string.generateStringOfLength(5));
			} catch (e) {
				err = e;
			}
			expect(err).to.not.be.eq(undefined);
		});
	});

	describe('lock account', () => {
		let account: models.AccountModel;

		beforeEach(async () => {
			account = await AccountEntity.create({
				username: 'username',
				password: 'password',
				salt: 'salt',
				telephone: 'telephone',
				email: 'email',
				mfa: true,
				activated: true,
				locked: false,
				role: 'ADMIN',
				pubKey: 'pubKey'
			});
		});

		it('locks account', async () => {
			await AccountEntity.lock(account.id!);
			expect((await AccountEntity.readById(account.id!))!.locked).to.be.eq(true);
		});

		it('fails to lock account if already locked', async () => {
			await AccountEntity.lock(account.id!);

			let err;
			try {
				await AccountEntity.lock(account.id!);
			} catch (e) {
				err = e;
			}
			expect(err).to.not.be.eq(undefined);
		});

		it('fails to lock account when error occurs', async () => {
			await shutdownMySqlClient();

			let err;
			try {
				await AccountEntity.lock(account.id!);
			} catch (e) {
				err = e;
			}
			expect(err).to.not.be.eq(undefined);
		});
	}); */
});
