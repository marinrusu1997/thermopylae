import { number, string, token } from '@marin/lib.utils';
import { models } from '@marin/lib.authentication-engine';
import { insertWithAssertion, MySqlClientInstance, queryAsync } from '@marin/lib.data-access';

import { describe } from 'mocha';
import { expect } from 'chai';

import { brokeConnectionWithMySqlServer, MySqlConnectionDetails, reconnectToMySqlServer } from '../fixtures/setup';
import { HashingAlgorithms, Roles, TEST_ENV } from '../fixtures/test-env';
import { it } from '../fixtures/mocha';

import { AuthRepository } from '../../lib';
import { AccountEntity } from '../../lib/auth/account';
import { ResourceType, SAFE_MYSQL_CHAR_REGEX } from '../fixtures/commons';

const { generateStringOfLength } = string;
const { hash } = token;

const TESTS_FOR_CONNECTION_FAILURE_TIMEOUT = 20_000;

describe('account spec', () => {
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
		})
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
			.schedule();

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
		})
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
			.schedule();

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
			account.email = generateStringOfLength(256, SAFE_MYSQL_CHAR_REGEX);
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
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
			.timeout(3000)
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
		})
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
			.schedule();

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
		})
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
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
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	function readSpec(readMethod: 'read' | 'readById', readBy: 'username' | 'id'): void {
		it('reads the right account when there are multiple ones', async () => {
			const firstAccount = await AuthRepository.accountEntity[readMethod](TEST_ENV.accounts.firstAccount.owner[readBy]!);
			expect(firstAccount).to.be.deep.eq(TEST_ENV.accounts.firstAccount.owner);

			const secondAccount = await AuthRepository.accountEntity[readMethod](TEST_ENV.accounts.secondAccount.owner[readBy]!);
			expect(secondAccount).to.be.deep.eq(TEST_ENV.accounts.secondAccount.owner);
		})
			.requires([ResourceType.ACCOUNT])
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
		})
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
			.schedule();

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
		})
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
			.schedule();

		it('returns null when account does not exist', async () => {
			const account = await AuthRepository.accountEntity[readMethod](generateStringOfLength(5, SAFE_MYSQL_CHAR_REGEX));
			expect(account).to.be.eq(null);
		})
			.releases('@nothing')
			.schedule();

		it('fails to read if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity[readMethod](generateStringOfLength(5));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
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
				const newPasswordHash = await hash(generateStringOfLength(10, SAFE_MYSQL_CHAR_REGEX));
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
			.requires([ResourceType.ACCOUNT])
			.schedule();

		it('updates password and salt, but hashing algorithm is left untouched', async () => {
			const accountId = await AuthRepository.accountEntity.create(TEST_ENV.accounts.firstAccount.owner);

			const newPasswordHash = await hash(generateStringOfLength(10, SAFE_MYSQL_CHAR_REGEX));
			const newSalt = (await token.generate(10)).plain;
			const oldHashingAlg = TEST_ENV.accounts.firstAccount.owner.hashingAlg;

			await AuthRepository.accountEntity.changePassword(accountId, newPasswordHash, newSalt, oldHashingAlg);

			const updateAccount = await AuthRepository.accountEntity.readById(accountId);
			expect(updateAccount!.password).to.be.eq(newPasswordHash);
			expect(updateAccount!.salt).to.be.eq(newSalt);
			expect(updateAccount!.hashingAlg).to.be.eq(oldHashingAlg);
		})
			.requires([ResourceType.ROLE])
			.releases(ResourceType.ACCOUNT)
			.schedule();

		it("users which do not own account can't change it's password", async () => {
			const newPasswordHash = await hash(generateStringOfLength(10, SAFE_MYSQL_CHAR_REGEX));
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
			.requires([ResourceType.ACCOUNT])
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
		})
			.releases(ResourceType.ACCOUNT)
			.schedule();

		it('fails to update password to non existing account', async () => {
			const nonExistingAccountID = generateStringOfLength(10, SAFE_MYSQL_CHAR_REGEX);
			const newPasswordHash = await hash(generateStringOfLength(10, SAFE_MYSQL_CHAR_REGEX));
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
		})
			.releases('@nothing')
			.schedule();

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
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('enable account spec', () => {
		it('enables account', async () => {
			const accountId = TEST_ENV.accounts.secondAccount.owner.id!;
			await AuthRepository.accountEntity.enable(accountId);

			expect((await AuthRepository.accountEntity.readById(accountId))!.enabled).to.be.eq(true);
		})
			.requires([ResourceType.ACCOUNT])
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
			.requires([ResourceType.ACCOUNT])
			.schedule();

		it('fails to enable account if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.enable(generateStringOfLength(5));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('disable account spec', () => {
		it('disables account', async () => {
			const accountId = TEST_ENV.accounts.firstAccount.owner.id!;
			await AuthRepository.accountEntity.disable(accountId);

			const account = (await AuthRepository.accountEntity.readById(accountId))!;
			expect(account.enabled).to.be.eq(false);
		})
			.requires([ResourceType.ACCOUNT])
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
			.requires([ResourceType.ACCOUNT])
			.schedule();

		it('fails to disable account if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.disable(generateStringOfLength(5));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('enable multi factor authentication spec', () => {
		it('enables multi factor authentication', async () => {
			const accountId = TEST_ENV.accounts.secondAccount.owner.id!;
			await AuthRepository.accountEntity.enableMultiFactorAuth(accountId);

			const account = (await AuthRepository.accountEntity.readById(accountId))!;
			expect(account.usingMfa).to.be.eq(true);
		})
			.requires([ResourceType.ACCOUNT])
			.schedule();

		it('fails to enable multi factor authentication when it is already enabled', async () => {
			const accountId = TEST_ENV.accounts.firstAccount.owner.id!;

			let alreadyEnabledErr;
			try {
				await AuthRepository.accountEntity.enableMultiFactorAuth(accountId);
			} catch (e) {
				alreadyEnabledErr = e;
			}

			expect(alreadyEnabledErr).to.haveOwnProperty(
				'message',
				`Failed to update multi factor authentication enabled status for account id ${accountId} to ${true}. No changes occurred. `
			);
		})
			.requires([ResourceType.ACCOUNT])
			.schedule();

		it('fails to enable multi factor authentication if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.enableMultiFactorAuth(generateStringOfLength(5));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('disable multi factor authentication spec', () => {
		it('disables multi factor authentication', async () => {
			const accountId = TEST_ENV.accounts.firstAccount.owner.id!;
			await AuthRepository.accountEntity.disableMultiFactorAuth(accountId);

			const account = (await AuthRepository.accountEntity.readById(accountId))!;
			expect(account.usingMfa).to.be.eq(false);
		})
			.requires([ResourceType.ACCOUNT])
			.schedule();

		it('fails to disable multi factor authentication when it is already disabled', async () => {
			const accountId = TEST_ENV.accounts.secondAccount.owner.id!;

			let alreadyDisabledErr;
			try {
				await AuthRepository.accountEntity.disableMultiFactorAuth(accountId);
			} catch (e) {
				alreadyDisabledErr = e;
			}

			expect(alreadyDisabledErr).to.haveOwnProperty(
				'message',
				`Failed to update multi factor authentication enabled status for account id ${accountId} to ${false}. No changes occurred. `
			);
		})
			.requires([ResourceType.ACCOUNT])
			.schedule();

		it('fails to disable multi factor authentication if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.disableMultiFactorAuth(generateStringOfLength(5));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('delete spec', () => {
		it("deletes account with all of it's associated resources", async () => {
			const accountId = TEST_ENV.accounts.firstAccount.owner.id!;
			const linkedUserId = TEST_ENV.accounts.firstAccount.firstLinkedUserId;

			const otherAccountId = TEST_ENV.accounts.secondAccount.owner.id!;
			const otherLinkedUserId = TEST_ENV.accounts.secondAccount.firstLinkedUserId;

			const Android = TEST_ENV.devices.ANDROID;
			const iOS = TEST_ENV.devices.IOS;

			const { RO } = TEST_ENV.locations;
			const { MD } = TEST_ENV.locations;

			const Chat = TEST_ENV.permissions.CHAT;
			const Accounting = TEST_ENV.permissions.ACCOUNTING;

			const Customer = TEST_ENV.roles.CUSTOMER;
			const Manager = TEST_ENV.roles.MANAGER;

			const Users = TEST_ENV.userGroups.USERS;
			const Moderators = TEST_ENV.userGroups.MODERATORS;
			const Managers = TEST_ENV.userGroups.MANAGERS;
			const Customers = TEST_ENV.userGroups.CUSTOMERS;

			// Add user sessions, failed auth attempts, role permissions, user group permissions, user group members
			const insertUserSessionsSQL = `INSERT INTO UserSession (CreatedAtUNIXTimestamp, RelatedUserID, Ip, IsActive, RelatedDeviceID, RelatedLocationID) VALUES
										  (123, '${accountId}', '0.0.0.0', true, '${Android.ID}', '${RO.ID}'),
										  (456, '${accountId}', '0.0.0.0', false, '${iOS.ID}', '${MD.ID}'),
										  (123, '${linkedUserId}', '0.0.0.0', false, '${iOS.ID}', '${MD.ID}'),
										  (123, '${otherAccountId}', '0.0.0.0', true, '${Android.ID}', '${RO.ID}'),
										  (123, '${otherLinkedUserId}', '0.0.0.0', true, '${Android.ID}', '${RO.ID}');`;
			const insertFailedAuthAttemptsSQL = `INSERT INTO FailedAuthenticationAttempt (Ip, RelatedDeviceID, RelatedAuthenticationID) VALUES 
												('0.0.0.0', '${Android.ID}', '${accountId}'),
												('0.0.0.0', '${iOS.ID}', '${accountId}'),
												('0.0.0.0', '${Android.ID}', '${otherAccountId}');`;
			const insertRolePermissionsSQL = `INSERT INTO RolePermissions (RelatedRoleID, RelatedPermissionID) VALUES
											  (${TEST_ENV.roles.USER.ID}, ${Chat.ID}),
											  (${TEST_ENV.roles.USER.ID}, ${Accounting.ID}),
											  (${TEST_ENV.roles.MODERATOR.ID}, ${Accounting.ID}),
											  (${Customer.ID}, ${Chat.ID}),
											  (${Customer.ID}, ${Accounting.ID}),
											  (${Manager.ID}, ${Chat.ID}),
											  (${Manager.ID}, ${Accounting.ID});`;
			const insertUserGroupPermissionsSQL = `INSERT INTO UserGroupPermissions (RelatedUserGroupID, RelatedPermissionID) VALUES 
												    (${Users.ID}, ${Chat.ID}),
													(${Users.ID}, ${Accounting.ID}),
													(${Moderators.ID}, ${Chat.ID}),
													(${Moderators.ID}, ${Accounting.ID}),
													(${Managers.ID}, ${Chat.ID}),
													(${Customers.ID}, ${Chat.ID});`;
			const insertUserGroupMembersSQL = `INSERT INTO UserGroupMembers (RelatedUserGroupID, RelatedUserID) VALUES 
											   (${Users.ID}, '${linkedUserId}'),
											   (${Users.ID}, '${otherLinkedUserId}'),
											   (${Moderators.ID}, '${accountId}'),
											   (${Moderators.ID}, '${otherLinkedUserId}'),
											   (${Managers.ID}, '${accountId}'),
											   (${Customers.ID}, '${otherLinkedUserId}');`;
			await Promise.all([
				insertWithAssertion(MySqlClientInstance.writePool, insertUserSessionsSQL, undefined, 'Failed INSERT User Sessions', 5),
				insertWithAssertion(MySqlClientInstance.writePool, insertFailedAuthAttemptsSQL, undefined, 'Failed INSERT Failed Auth Attempts', 3),
				insertWithAssertion(MySqlClientInstance.writePool, insertRolePermissionsSQL, undefined, 'Failed INSERT Role Permissions', 7),
				insertWithAssertion(MySqlClientInstance.writePool, insertUserGroupPermissionsSQL, undefined, 'Failed INSERT User Group Permissions', 6),
				insertWithAssertion(MySqlClientInstance.writePool, insertUserGroupMembersSQL, undefined, 'Failed INSERT User Group Members', 6)
			]);

			// Delete account
			await AuthRepository.accountEntity.delete(accountId);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Account;')).results[0].row_count).to.be.eq(1);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Authentication;')).results[0].row_count).to.be.eq(1);
			expect(
				(await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM FailedAuthenticationAttempt;')).results[0].row_count
			).to.be.eq(1);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM User;')).results[0].row_count).to.be.eq(2);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Contact;')).results[0].row_count).to.be.eq(4);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserSession;')).results[0].row_count).to.be.eq(2);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroupMembers;')).results[0].row_count).to.be.eq(3);

			// Delete group
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM UserGroup WHERE ID = ${Users.ID};`)).results.affectedRows).to.be.eq(1);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroup;')).results[0].row_count).to.be.eq(3);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroupMembers;')).results[0].row_count).to.be.eq(2);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroupPermissions;')).results[0].row_count).to.be.eq(
				4
			);

			// Delete role
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM Role WHERE ID = ${TEST_ENV.roles.USER.ID};`)).results.affectedRows).to.be.eq(
				1
			);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Role;')).results[0].row_count).to.be.eq(3);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM RolePermissions;')).results[0].row_count).to.be.eq(5);
			expect(
				(await queryAsync(MySqlClientInstance.readPool, `SELECT * FROM \`User\` WHERE ID = '${otherLinkedUserId}';`)).results[0].RelatedRoleID
			).to.be.eq(null);

			// Delete permission
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM Permission WHERE ID = ${Chat.ID};`)).results.affectedRows).to.be.eq(1);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Permission;')).results[0].row_count).to.be.eq(1);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroupPermissions;')).results[0].row_count).to.be.eq(
				1
			);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM RolePermissions;')).results[0].row_count).to.be.eq(3);

			// Delete user owning second account
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM \`User\` WHERE ID = '${otherAccountId}';`)).results.affectedRows).to.be.eq(1);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Account;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Authentication;')).results[0].row_count).to.be.eq(0);
			expect(
				(await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM FailedAuthenticationAttempt;')).results[0].row_count
			).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM User;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Contact;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserSession;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroupMembers;')).results[0].row_count).to.be.eq(0);

			// Now it is possible to delete safely locations and devices
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM Device;`)).results.affectedRows).to.be.eq(2);
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM Location;`)).results.affectedRows).to.be.eq(2);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Device;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Location;')).results[0].row_count).to.be.eq(0);

			// Delete permissions, roles, user groups
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM Permission;`)).results.affectedRows).to.be.eq(1);
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM Role;`)).results.affectedRows).to.be.eq(3);
			expect((await queryAsync(MySqlClientInstance.writePool, `DELETE FROM UserGroup;`)).results.affectedRows).to.be.eq(3);

			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Permission;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM Role;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroup;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM RolePermissions;')).results[0].row_count).to.be.eq(0);
			expect((await queryAsync(MySqlClientInstance.readPool, 'SELECT COUNT(*) as row_count FROM UserGroupPermissions;')).results[0].row_count).to.be.eq(
				0
			);
		})
			.requires([ResourceType.LOCATION, ResourceType.DEVICE, ResourceType.PERMISSION, ResourceType.ROLE, ResourceType.USER_GROUP, ResourceType.ACCOUNT])
			.timeout(5000, true)
			.schedule();

		it('fails to delete account which does not exist', async () => {
			const accountId = generateStringOfLength(5, SAFE_MYSQL_CHAR_REGEX);

			let notExistingAccountErr;
			try {
				await AuthRepository.accountEntity.delete(accountId);
			} catch (e) {
				notExistingAccountErr = e;
			}

			expect(notExistingAccountErr).to.haveOwnProperty('message', `Failed to delete account with id ${accountId}. No affected rows. `);
		}).schedule();

		it('fails to delete account if network or transport error is encountered', async () => {
			await brokeConnectionWithMySqlServer();

			let connectionError: Error;
			try {
				await AuthRepository.accountEntity.delete(generateStringOfLength(5));
			} catch (e) {
				connectionError = e;
			}
			expect(connectionError!.message).to.be.oneOf([
				'Connection lost: The server closed the connection.',
				`connect ECONNREFUSED ${MySqlConnectionDetails.host}:${MySqlConnectionDetails.port}`
			]);

			await reconnectToMySqlServer();
		})
			.releases('@nothing')
			.timeout(TESTS_FOR_CONNECTION_FAILURE_TIMEOUT)
			.schedule();
	});

	describe('performance spec', () => {});
});
