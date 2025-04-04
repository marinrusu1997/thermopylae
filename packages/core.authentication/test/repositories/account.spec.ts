import { faker } from '@faker-js/faker';
import { Exception } from '@thermopylae/lib.exception';
import { chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { AccountMySqlRepository, ErrorCodes } from '../../lib/index.js';
import { generateAccount, randomDisabledUntil } from '../fixtures/generator.js';

describe(`${AccountMySqlRepository.name} spec`, function suite() {
	const accountRepository = new AccountMySqlRepository();

	describe(`${AccountMySqlRepository.prototype.insert.name} spec`, () => {
		it('inserts account without optional fields', async () => {
			/* INSERT ACCOUNT */
			const account = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
			const duplicatedFields = await accountRepository.insert(account);
			expect(typeof account.id).to.be.eq('string');
			expect(duplicatedFields).to.be.eq(null);

			/* READ IT BY ID */
			const readAccount = await accountRepository.readById(account.id);
			expect(readAccount).to.be.deep.eq(account);
		});

		it('inserts account with all fields', async () => {
			/* INSERT ACCOUNT */
			const account = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(account);
			expect(typeof account.id).to.be.eq('string');

			/* READ IT BY ID */
			const readAccount = await accountRepository.readById(account.id);
			expect(readAccount).to.be.deep.eq(account);
		});

		it('returns duplicated fields', async () => {
			/* INSERT ACCOUNT */
			const account = generateAccount({ nullify: ['id'] });
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
			const account = generateAccount({ nullify: ['id'] });
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

		it('returns duplicated fields (multiple accounts in the repo)', { timeout: 5000 }, async () => {
			/* INSERT ACCOUNTS */
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			const thirdAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(thirdAccount);
			expect(typeof thirdAccount.id).to.be.eq('string');

			/* CHECK FOR DUPLICATES */
			const duplicateAccount = generateAccount({
				nullify: ['id'],
				include: {
					username: firstAccount.username,
					email: secondAccount.email,
					telephone: thirdAccount.telephone
				}
			});

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
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
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
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
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
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
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
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* READ IT BY ID */
			await expect(accountRepository.readByTelephone('does-not-exist')).resolves.to.be.eq(null);

			const readAccount = await accountRepository.readByTelephone(firstAccount.telephone ?? '');
			expect(readAccount).to.be.deep.eq(firstAccount);
		});
	});

	describe(`${AccountMySqlRepository.prototype.setDisabledUntil.name} spec`, () => {
		it('fails to set disabled until for non existing accounts', async () => {
			let err: Exception | null = null;
			try {
				await accountRepository.setDisabledUntil('1', chrono.unix());
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
			expect(err).to.haveOwnProperty('message', `Account with id '${'1'}' not found.`);
		});

		it('sets disabled until for existing account', async () => {
			/* INSERT ACCOUNT */
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* CHANGE MFA */
			let disabledUntil: number | null = null;
			while ((disabledUntil = randomDisabledUntil()) === firstAccount.disabledUntil) {
				continue;
			}
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
			let err: Error | null = null;
			try {
				await accountRepository.update('1', { mfa: true });
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
			expect(err).to.haveOwnProperty('message', `Account with id '${'1'}' not found.`);
		});

		it('updates existing account', async () => {
			/* INSERT ACCOUNT */
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
			await accountRepository.insert(secondAccount);
			expect(typeof secondAccount.id).to.be.eq('string');

			/* UPDATE */
			const update = generateAccount({ delete: ['id'] });
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
			let err: Error | null = null;
			try {
				await accountRepository.changePassword('1', 'pwd', null, 0);
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
			expect(err).to.haveOwnProperty('message', `Account with id '${'1'}' not found.`);
		});

		it('changes password of existing account', async () => {
			/* INSERT ACCOUNT */
			const firstAccount = generateAccount({ nullify: ['id'] });
			await accountRepository.insert(firstAccount);
			expect(typeof firstAccount.id).to.be.eq('string');

			const secondAccount = generateAccount({ nullify: ['id', 'passwordSalt', 'telephone', 'totpSecret', 'pubKey'] });
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
