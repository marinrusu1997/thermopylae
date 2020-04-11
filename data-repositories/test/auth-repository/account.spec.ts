import { number, string, token } from '@marin/lib.utils';
import { models } from '@marin/lib.authentication-engine';
import { insertWithAssertion, MySqlClientInstance, queryAsync } from '@marin/lib.data-access';

import { describe, before, afterEach } from 'mocha';
import { expect } from 'chai';
import { MySqlEnv } from '../fixtures/setup';
import { TEST_ENV, setUpDatabase, clearEnvAccounts, HashingAlgorithms, Roles } from '../fixtures/env';
import { it, brokeConnectionWithMySqlServer, reconnectToMySqlServer } from '../utils';

import { AuthRepository } from '../../lib';
import { AccountEntity } from '../../lib/auth/account';

const { generateStringOfLength } = string;
const { hash } = token;

const GENERATE_STRING_REGEX = /[a-zA-Z0-9>!@#$%^&*()_+=-}{[\]:;"\\|?/.<,`~]/;
const TESTS_FOR_CONNECTION_FAILURE_TIMEOUT = 17_000;

describe('account spec', () => {
	before(function (done) {
		this.timeout(15000);

		setUpDatabase(done);
	});

	afterEach(function (done) {
		this.timeout(3000);

		clearEnvAccounts(done);
	});

	describe('create spec', () => {
		it('creates multiple accounts', async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password',
				salt: 'salt',
				hashingAlg: HashingAlgorithms.BCRYPT,
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			account.hashingAlg = HashingAlgorithms.ARGON2;
			account.username = 'username2';
			account.role = Roles.MODERATOR;
			account.usingMfa = false;
			account.enabled = false;
			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);
		}).schedule();

		it('after account is created, new users can be added to the same account', async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password',
				salt: 'salt',
				hashingAlg: HashingAlgorithms.BCRYPT,
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			const insertUserSQL = `INSERT INTO User (ID, RelatedAccountID, RelatedRoleID) SELECT 'true random', '${account.id}', ID FROM Role WHERE Name = '${Roles.MODERATOR}';`;
			await insertWithAssertion(MySqlClientInstance.writePool, insertUserSQL);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM User;')).results[0].row_count).to.be.eq(2);
		}).schedule();

		it("rollback's transaction if something goes wrong", async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password',
				salt: 'salt',
				hashingAlg: HashingAlgorithms.ARGON2,
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
			};
			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			account.username = 'username2';
			account.email = generateStringOfLength(256, GENERATE_STRING_REGEX);
			account.usingMfa = false;
			account.enabled = false;
			account.role = Roles.MODERATOR;

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
		})
			.timeout(3000)
			.schedule();

		it('fails to create account if network or transport error is encountered', async () => {
			const account: models.AccountModel = {
				username: 'username',
				password: 'password',
				salt: 'salt',
				hashingAlg: HashingAlgorithms.ARGON2,
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
			};

			await brokeConnectionWithMySqlServer();

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

			await reconnectToMySqlServer();
		})
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();

		it('fails to create accounts with the same username', async () => {
			const account: models.AccountModel = {
				username: 'username',
				password: 'password',
				salt: 'salt',
				hashingAlg: HashingAlgorithms.ARGON2,
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
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
		}).schedule();

		it('fails to create account with a role which does not exist', async () => {
			let err;
			try {
				const account: models.AccountModel = {
					username: 'username',
					password: 'password',
					salt: 'salt',
					hashingAlg: HashingAlgorithms.BCRYPT,
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
		}).schedule();

		it('fails to add duplicate contacts to an existing user', async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password',
				salt: 'salt',
				hashingAlg: HashingAlgorithms.BCRYPT,
				telephone: 'telephone',
				email: 'email',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id.length).to.be.eq(AccountEntity.ACCOUNT_ID_LENGTH);

			let insertDuplicateContactsErr;
			try {
				const insertContactsSQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.EMAIL_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${account.id}'),
										('${AccountEntity.TELEPHONE_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${account.id}');`;
				await insertWithAssertion(
					MySqlClientInstance.writePool,
					insertContactsSQL,
					['email2', 'telephone2'],
					'Failed to INSERT linked user contacts',
					2
				);
			} catch (e) {
				insertDuplicateContactsErr = e;
			}
			expect(insertDuplicateContactsErr.message).to.match(/ER_DUP_ENTRY: Duplicate entry 'email-primary-(\d|[a-f]){10}' for key 'Contact.UK_ContactURI'/);
		}).schedule();
	});

	function readSpec(readMethod: 'read' | 'readById', readBy: 'username' | 'id'): void {
		it('reads the right account when there are multiple ones', async () => {
			const firstAccount = await AuthRepository.accountEntity[readMethod](TEST_ENV.accounts.firstAccount.owner[readBy]!);
			expect(firstAccount).to.be.deep.eq(TEST_ENV.accounts.firstAccount.owner);

			const secondAccount = await AuthRepository.accountEntity[readMethod](TEST_ENV.accounts.secondAccount.owner[readBy]!);
			expect(secondAccount).to.be.deep.eq(TEST_ENV.accounts.secondAccount.owner);
		})
			.dependsOn({ envAccounts: true })
			.schedule();

		it('reads the account with contacts used by the system when user has multiple ones', async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password1',
				salt: 'salt1',
				hashingAlg: HashingAlgorithms.ARGON2,
				telephone: 'telephone1',
				email: 'email1',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id).to.be.a('string').with.lengthOf(AccountEntity.ACCOUNT_ID_LENGTH);

			const insertContactsSQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.EMAIL_CONTACT_CLASS}', 'non-system-type1', ?, '${account.id}'),
										('${AccountEntity.TELEPHONE_CONTACT_CLASS}', 'non-system-type2', ?, '${account.id}');`;
			await insertWithAssertion(MySqlClientInstance.writePool, insertContactsSQL, ['email2', 'telephone2'], 'Failed to INSERT linked user contacts', 2);

			expect(await AuthRepository.accountEntity[readMethod](account[readBy]!)).to.be.deep.eq(account);
		}).schedule();

		it('reads the right account when there are multiple users with different contacts linked to the same account', async () => {
			const account: models.AccountModel = {
				username: 'username1',
				password: 'password1',
				salt: 'salt1',
				hashingAlg: HashingAlgorithms.BCRYPT,
				telephone: 'telephone1',
				email: 'email1',
				usingMfa: true,
				enabled: true,
				role: Roles.USER
			};

			account.id = await AuthRepository.accountEntity.create(account);
			expect(account.id).to.be.a('string').with.lengthOf(AccountEntity.ACCOUNT_ID_LENGTH);

			const linkedUserId = 'linkeduserid';
			const insertUserSQL = `INSERT INTO User (ID, RelatedAccountID, RelatedRoleID) SELECT '${linkedUserId}', '${account.id}', ID FROM Role WHERE Name = '${Roles.MODERATOR}';`;
			await insertWithAssertion(MySqlClientInstance.writePool, insertUserSQL, undefined, 'Failed to INSERT linked user');

			const insertContactsSQL = `INSERT INTO Contact (Class, Type, Contact, RelatedUserID) VALUES
										('${AccountEntity.EMAIL_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${linkedUserId}'),
										('${AccountEntity.TELEPHONE_CONTACT_CLASS}', '${AccountEntity.CONTACT_TYPE_USED_BY_SYSTEM}', ?, '${linkedUserId}');`;
			await insertWithAssertion(MySqlClientInstance.writePool, insertContactsSQL, ['email2', 'telephone2'], 'Failed to INSERT linked user contacts', 2);

			expect(await AuthRepository.accountEntity[readMethod](account[readBy]!)).to.be.deep.eq(account);
		}).schedule();

		it('returns null when account does not exist', async () => {
			const account = await AuthRepository.accountEntity[readMethod](generateStringOfLength(5, GENERATE_STRING_REGEX));
			expect(account).to.be.eq(null);
		}).schedule();

		it('fails to read if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity[readMethod](generateStringOfLength(5, GENERATE_STRING_REGEX));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlEnv.host}:${MySqlEnv.port}`
			]);

			await reconnectToMySqlServer();
		})
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	}

	describe('read by username spec', () => {
		readSpec('read', 'username');
	});

	describe('read by id spec', () => {
		readSpec('readById', 'id');
	});

	describe('change password spec', () => {
		it('updates password of the right account', async () => {
			async function doTestChangePassword(account: models.AccountModel): Promise<void> {
				const newPasswordHash = await hash(generateStringOfLength(10, GENERATE_STRING_REGEX));
				const newSalt = (await token.generate(10)).plain;
				const newHashingAlg = number.generateRandom(1, 10);

				await AuthRepository.accountEntity.changePassword(account.id!, newPasswordHash, newSalt, newHashingAlg);

				const updateAccount = await AuthRepository.accountEntity.readById(account.id!);
				expect(updateAccount!.password).to.be.eq(newPasswordHash);
				expect(updateAccount!.salt).to.be.eq(newSalt);
				expect(updateAccount!.hashingAlg).to.be.eq(newHashingAlg);
			}

			await doTestChangePassword(TEST_ENV.accounts.firstAccount.owner);
			await doTestChangePassword(TEST_ENV.accounts.secondAccount.owner);
		})
			.dependsOn({ envAccounts: true })
			.schedule();

		it('updates password and salt, but hashing algorithm is left untouched', async () => {
			const accountId = await AuthRepository.accountEntity.create(TEST_ENV.accounts.firstAccount.owner);

			const newPasswordHash = await hash(generateStringOfLength(10, GENERATE_STRING_REGEX));
			const newSalt = (await token.generate(10)).plain;
			const oldHashingAlg = TEST_ENV.accounts.firstAccount.owner.hashingAlg;

			await AuthRepository.accountEntity.changePassword(accountId, newPasswordHash, newSalt, oldHashingAlg);

			const updateAccount = await AuthRepository.accountEntity.readById(accountId);
			expect(updateAccount!.password).to.be.eq(newPasswordHash);
			expect(updateAccount!.salt).to.be.eq(newSalt);
			expect(updateAccount!.hashingAlg).to.be.eq(oldHashingAlg);
		}).schedule();

		it("users which do not own account can't change it's password", async () => {
			const newPasswordHash = await hash(generateStringOfLength(10, GENERATE_STRING_REGEX));
			const newSalt = (await token.generate(10)).plain;
			const newHashingAlg = number.generateRandom(1, 10);

			let unauthorizedChangePasswordErr;
			try {
				await AuthRepository.accountEntity.changePassword(TEST_ENV.accounts.firstAccount.firstLinkedUserId, newPasswordHash, newSalt, newHashingAlg);
			} catch (e) {
				unauthorizedChangePasswordErr = e;
			}
			expect(unauthorizedChangePasswordErr).to.haveOwnProperty(
				'message',
				`Failed to change password and salt for account id ${TEST_ENV.accounts.firstAccount.firstLinkedUserId} . No changes occurred. `
			);
		})
			.dependsOn({ envAccounts: true })
			.schedule();

		it('fails to update password if new password hash and salt are the same as the old ones', async () => {
			const accountId = await AuthRepository.accountEntity.create(TEST_ENV.accounts.firstAccount.owner);

			const newPassword = TEST_ENV.accounts.firstAccount.owner.password;
			const newSalt = TEST_ENV.accounts.firstAccount.owner.salt;
			const newHashingAlg = TEST_ENV.accounts.firstAccount.owner.hashingAlg;

			let samePasswordErr;
			try {
				await AuthRepository.accountEntity.changePassword(accountId, newPassword, newSalt, newHashingAlg);
			} catch (e) {
				samePasswordErr = e;
			}
			expect(samePasswordErr).to.haveOwnProperty('message', `Failed to change password and salt for account id ${accountId} . No changes occurred. `);
		}).schedule();

		it('fails to update password to non existing account', async () => {
			const nonExistingAccountID = generateStringOfLength(10, GENERATE_STRING_REGEX);
			const newPasswordHash = await hash(generateStringOfLength(10, GENERATE_STRING_REGEX));
			const newSalt = (await token.generate(10)).plain;
			const newHashingAlg = number.generateRandom(1, 10);

			let nonExistingAccountError;
			try {
				await AuthRepository.accountEntity.changePassword(nonExistingAccountID, newPasswordHash, newSalt, newHashingAlg);
			} catch (e) {
				nonExistingAccountError = e;
			}
			expect(nonExistingAccountError).to.haveOwnProperty(
				'message',
				`Failed to change password and salt for account id ${nonExistingAccountID} . No changes occurred. `
			);
		}).schedule();

		it('fails to update password if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.changePassword("doesn't matter", "doesn't matter", "doesn't matter", 0);
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlEnv.host}:${MySqlEnv.port}`
			]);

			await reconnectToMySqlServer();
		})
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('enable account spec', () => {
		it('enables account', async () => {
			const accountId = TEST_ENV.accounts.secondAccount.owner.id!;
			await AuthRepository.accountEntity.enable(accountId);

			expect((await AuthRepository.accountEntity.readById(accountId))!.enabled).to.be.eq(true);
		})
			.dependsOn({ envAccounts: true })
			.schedule();

		it('fails to enable account which is already enabled', async () => {
			const accountId = TEST_ENV.accounts.firstAccount.owner.id!;

			let alreadyEnabledErr;
			try {
				await AuthRepository.accountEntity.enable(accountId);
			} catch (e) {
				alreadyEnabledErr = e;
			}

			expect(alreadyEnabledErr).to.haveOwnProperty(
				'message',
				`Failed to update enabled status for account id ${accountId} to ${true}. No changes occurred. `
			);
		})
			.dependsOn({ envAccounts: true })
			.schedule();

		it('fails to enable account if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.enable(generateStringOfLength(5, GENERATE_STRING_REGEX));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlEnv.host}:${MySqlEnv.port}`
			]);

			await reconnectToMySqlServer();
		})
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('disable account spec', () => {
		it('disables account', async () => {
			const accountId = TEST_ENV.accounts.firstAccount.owner.id!;
			await AuthRepository.accountEntity.disable(accountId);

			expect((await AuthRepository.accountEntity.readById(accountId))!.enabled).to.be.eq(false);
		})
			.dependsOn({ envAccounts: true })
			.schedule();

		it('fails to disable account which is already disabled', async () => {
			const accountId = TEST_ENV.accounts.secondAccount.owner.id!;

			let alreadyDisabledErr;
			try {
				await AuthRepository.accountEntity.disable(accountId);
			} catch (e) {
				alreadyDisabledErr = e;
			}

			expect(alreadyDisabledErr).to.haveOwnProperty(
				'message',
				`Failed to update enabled status for account id ${accountId} to ${false}. No changes occurred. `
			);
		})
			.dependsOn({ envAccounts: true })
			.schedule();

		it('fails to disable account if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.disable(generateStringOfLength(5, GENERATE_STRING_REGEX));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlEnv.host}:${MySqlEnv.port}`
			]);

			await reconnectToMySqlServer();
		})
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});
});
