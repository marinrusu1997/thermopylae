import { faker } from '@faker-js/faker';
import { AccountStatus, type AccountWithTotpSecret } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { array, chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { AccountMySqlRepository, ErrorCodes } from '../../lib/index.js';

describe(`${AccountMySqlRepository.name} spec`, { timeout: 2_500 }, function suite() {
	const accountRepository = new AccountMySqlRepository();

	describe(`${AccountMySqlRepository.prototype.insert.name} spec`, () => {
		it('inserts account without optional fields', async () => {
			/* INSERT ACCOUNT */
			const account: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			const duplicatedFields = await accountRepository.insert(account);
			expect(typeof account.id).to.be.eq('string');
			expect(duplicatedFields).to.be.eq(null);

			/* READ IT BY ID */
			const readAccount = await accountRepository.readById(account.id);
			expect(readAccount).to.be.deep.eq(account);
		});

		it('inserts account with all fields', async () => {
			/* INSERT ACCOUNT */
			const account: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(account);
			expect(typeof account.id).to.be.eq('string');

			/* READ IT BY ID */
			const readAccount = await accountRepository.readById(account.id);
			expect(readAccount).to.be.deep.eq(account);
		});

		it('returns duplicated fields', async () => {
			/* INSERT ACCOUNT */
			const account: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			let duplicatedFields = await accountRepository.insert(account);
			expect(typeof account.id).to.be.eq('string');
			expect(duplicatedFields).to.be.eq(null);

			/* INSERT DUPLICATE ACCOUNT */
			duplicatedFields = await accountRepository.insert(account);
			expect(duplicatedFields).toStrictEqual(['username']);

			account.username = 'notduplicate';
			duplicatedFields = await accountRepository.insert(account);
			expect(duplicatedFields).toStrictEqual(['email']);

			account.email = 'notduplicate';
			duplicatedFields = await accountRepository.insert(account);
			expect(duplicatedFields).toStrictEqual(['telephone']);

			/* INSERT NOT DUPLICATE ACCOUNT */
			account.telephone = 'notduplicate';
			duplicatedFields = await accountRepository.insert(account);
			expect(typeof account.id).to.be.eq('string');
			expect(duplicatedFields).to.be.eq(null);
		});
	});

	describe(`${AccountMySqlRepository.prototype.isDuplicate.name} spec`, () => {
		it('returns duplicated fields', async () => {
			/* INSERT ACCOUNT */
			const account: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			let duplicatedFields = await accountRepository.isDuplicate(account); // when no acc
			expect(duplicatedFields).to.be.eq(null);

			duplicatedFields = await accountRepository.insert(account);
			expect(typeof account.id).to.be.eq('string');
			expect(duplicatedFields).to.be.eq(null);

			/* CHECK FOR DUPLICATES */
			duplicatedFields = await accountRepository.isDuplicate(account);
			expect(duplicatedFields).toStrictEqual(['username', 'email', 'telephone']);

			account.username = 'notduplicate';
			duplicatedFields = await accountRepository.isDuplicate(account);
			expect(duplicatedFields).toStrictEqual(['email', 'telephone']);

			account.email = 'notduplicate';
			duplicatedFields = await accountRepository.isDuplicate(account);
			expect(duplicatedFields).toStrictEqual(['telephone']);

			account.telephone = 'notduplicate';
			duplicatedFields = await accountRepository.isDuplicate(account);
			expect(duplicatedFields).to.be.eq(null);
		});

		it('returns duplicated fields (multiple accounts in the repo)', { timeout: 5_000 }, async () => {
			/* INSERT ACCOUNTS */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			const thirdAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(thirdAccount);
			expect(typeof thirdAccount.id).to.be.eq('string');

			/* CHECK FOR DUPLICATES */
			const duplicateAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: firstAccount.username,
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: secondAccount.email,
				telephone: thirdAccount.telephone,
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};

			let duplicatedFields = await accountRepository.isDuplicate(duplicateAccount);
			expect(duplicatedFields).toStrictEqual(['username', 'email', 'telephone']);

			duplicateAccount.username = 'notduplicate';
			duplicatedFields = await accountRepository.isDuplicate(duplicateAccount);
			expect(duplicatedFields).toStrictEqual(['email', 'telephone']);

			duplicateAccount.email = 'notduplicate';
			duplicatedFields = await accountRepository.isDuplicate(duplicateAccount);
			expect(duplicatedFields).toStrictEqual(['telephone']);

			duplicateAccount.telephone = 'notduplicate';
			duplicatedFields = await accountRepository.isDuplicate(duplicateAccount);
			expect(duplicatedFields).to.be.eq(null);
		});
	});

	describe(`${AccountMySqlRepository.prototype.readById.name} spec`, () => {
		it('returns null when there are no accounts', async () => {
			await expect(accountRepository.readById('1')).resolves.to.be.eq(null);
		});

		it('returns account with requested id when there are multiple accounts', async () => {
			/* INSERT ACCOUNT */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* READ IT BY ID */
			await expect(accountRepository.readById('1')).resolves.to.be.eq(null);

			const readAccount = await accountRepository.readById(secondAccount.id);
			expect(readAccount).to.be.deep.eq(secondAccount);
		});
	});

	describe(`${AccountMySqlRepository.prototype.readByUsername.name} spec`, () => {
		it('returns null when there are no accounts', async () => {
			await expect(accountRepository.readByUsername('does-not-exist')).resolves.to.be.eq(null);
		});

		it('returns account with requested username when there are multiple accounts', async () => {
			/* INSERT ACCOUNT */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* READ IT BY ID */
			await expect(accountRepository.readByUsername('does-not-exist')).resolves.to.be.eq(null);

			const readAccount = await accountRepository.readByUsername(secondAccount.username);
			expect(readAccount).to.be.deep.eq(secondAccount);
		});
	});

	describe(`${AccountMySqlRepository.prototype.readByEmail.name} spec`, () => {
		it('returns null when there are no accounts', async () => {
			await expect(accountRepository.readByEmail('does-not-exist')).resolves.to.be.eq(null);
		});

		it('returns account with requested email when there are multiple accounts', async () => {
			/* INSERT ACCOUNT */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* READ IT BY ID */
			await expect(accountRepository.readByEmail('does-not-exist')).resolves.to.be.eq(null);

			const readAccount = await accountRepository.readByEmail(secondAccount.email);
			expect(readAccount).to.be.deep.eq(secondAccount);
		});
	});

	describe(`${AccountMySqlRepository.prototype.readByTelephone.name} spec`, () => {
		it('returns null when there are no accounts', async () => {
			await expect(accountRepository.readByTelephone('does-not-exist')).resolves.to.be.eq(null);
		});

		it('returns account with requested telephone when there are multiple accounts', async () => {
			/* INSERT ACCOUNT */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* READ IT BY ID */
			await expect(accountRepository.readByTelephone('does-not-exist')).resolves.to.be.eq(null);

			const readAccount = await accountRepository.readByTelephone(firstAccount.telephone!);
			expect(readAccount).to.be.deep.eq(firstAccount);
		});
	});

	describe(`${AccountMySqlRepository.prototype.setDisabledUntil.name} spec`, () => {
		it('fails to set disabled until for non existing accounts', async () => {
			let err;
			try {
				await accountRepository.setDisabledUntil('1', chrono.unixTime());
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
			expect(err).to.haveOwnProperty('message', `Account with id '${'1'}' not found.`);
		});

		it('sets disabled until for existing account', async () => {
			const disabledUntilValues = [AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()];

			/* INSERT ACCOUNT */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement(disabledUntilValues),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement(disabledUntilValues),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* CHANGE MFA */
			let disabledUntil;
			while ((disabledUntil = array.randomElement(disabledUntilValues)) === firstAccount.disabledUntil);
			await accountRepository.setDisabledUntil(firstAccount.id, disabledUntil);

			await expect(accountRepository.readById(firstAccount.id)).resolves.to.be.deep.eq({
				...firstAccount,
				disabledUntil
			});
			await expect(accountRepository.readById(secondAccount.id)).resolves.to.be.deep.eq(secondAccount);
		});
	});

	describe(`${AccountMySqlRepository.prototype.update.name} spec`, () => {
		it('fails to update non existing accounts', async () => {
			let err;
			try {
				await accountRepository.update('1', { mfa: true });
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
			expect(err).to.haveOwnProperty('message', `Account with id '${'1'}' not found.`);
		});

		it('updates existing account', async () => {
			const disabledUntilValues = [AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()];

			/* INSERT ACCOUNT */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement(disabledUntilValues),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement(disabledUntilValues),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* UPDATE */
			const update: Partial<AccountWithTotpSecret> = {
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement(disabledUntilValues),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.update(firstAccount.id, update);

			await expect(accountRepository.readById(firstAccount.id)).resolves.to.be.deep.eq({
				...update,
				id: firstAccount.id
			});
			await expect(accountRepository.readById(secondAccount.id)).resolves.to.be.deep.eq(secondAccount);
		});
	});

	describe(`${AccountMySqlRepository.prototype.changePassword.name} spec`, () => {
		it('fails to change password of non existing account', async () => {
			let err;
			try {
				await accountRepository.changePassword('1', 'pwd', null, 0);
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
			expect(err).to.haveOwnProperty('message', `Account with id '${'1'}' not found.`);
		});

		it('changes password of existing account', async () => {
			const disabledUntilValues = [AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()];

			/* INSERT ACCOUNT */
			const firstAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: faker.string.alphanumeric({ length: 10 }),
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: faker.phone.number(),
				disabledUntil: array.randomElement(disabledUntilValues),
				mfa: faker.datatype.boolean(),
				totpSecret: faker.string.alphanumeric({ length: 10 }),
				pubKey: faker.string.alphanumeric({ length: 50 })
			};
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount: AccountWithTotpSecret = {
				id: undefined!,
				username: faker.internet.username(),
				passwordHash: faker.internet.password(),
				passwordSalt: null,
				passwordAlg: faker.number.int({ min: 0, max: 9 }),
				email: faker.internet.email(),
				telephone: null,
				disabledUntil: array.randomElement(disabledUntilValues),
				mfa: faker.datatype.boolean(),
				totpSecret: null!,
				pubKey: null
			};
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* UPDATE */
			const passwordHash = faker.internet.password();
			const passwordSalt = null;
			const passwordAlg = faker.number.int({ min: 0, max: 9 });

			await accountRepository.changePassword(firstAccount.id, passwordHash, passwordSalt, passwordAlg);

			await expect(accountRepository.readById(firstAccount.id)).resolves.to.be.deep.eq({
				...firstAccount,
				passwordHash,
				passwordSalt,
				passwordAlg
			});
			await expect(accountRepository.readById(secondAccount.id)).resolves.to.be.deep.eq(secondAccount);
		});
	});
});
