import type { HttpDevice } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { randomInt } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountMySqlRepository, SuccessfulAuthenticationsMysqlRepository } from '../../lib/index.js';
import { generateAccount, generateDevice, generateSuccessfulAuthenticationModel } from '../fixtures/generator.js';

describe(`${SuccessfulAuthenticationsMysqlRepository.name} spec`, function suite() {
	const successfulAuthenticationRepository = new SuccessfulAuthenticationsMysqlRepository();
	const accountRepository = new AccountMySqlRepository();

	const firstAccount = generateAccount();
	const secondAccount = generateAccount();

	beforeEach(async () => {
		await Promise.all([accountRepository.insert(firstAccount), accountRepository.insert(secondAccount)]);
	}, 2500);

	describe(`${SuccessfulAuthenticationsMysqlRepository.prototype.insert.name} spec`, () => {
		it('inserts authentication without device and location', async () => {
			const successfulAuth = generateSuccessfulAuthenticationModel(firstAccount, {
				nullify: ['id', 'device', 'location']
			});
			await successfulAuthenticationRepository.insert(successfulAuth);

			expect(typeof successfulAuth.id).to.be.eq('string');
		});
	});

	describe(`${SuccessfulAuthenticationsMysqlRepository.prototype.authBeforeFromThisDevice.name} spec`, () => {
		it('returns false when there are no authentications at all', async () => {
			const device = generateDevice();
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, device)).resolves.to.be.eq(false);
		});

		it('returns false when there is authentication without device', async () => {
			const successfulAuth = generateSuccessfulAuthenticationModel(firstAccount, {
				nullify: ['id', 'device', 'location']
			});
			await successfulAuthenticationRepository.insert(successfulAuth);
			expect(typeof successfulAuth.id).to.be.eq('string');

			const device = generateDevice();
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, device)).resolves.to.be.eq(false);
		});

		it('returns false when there is authentication from different device', async () => {
			const successfulAuth = generateSuccessfulAuthenticationModel(firstAccount, {
				nullify: ['id', 'location'],
				include: {
					device: generateDevice()
				}
			});
			expect(successfulAuth.device).toBeDefined();
			expect(successfulAuth.device).not.toBeNull();

			await successfulAuthenticationRepository.insert(successfulAuth);
			expect(typeof successfulAuth.id).to.be.eq('string');

			const device = generateDevice(
				'Mozilla/5.0 (Linux; Android 9; INE-LX1r; HMSCore 5.1.1.303; GMSCore 21.02.14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 HuaweiBrowser/11.0.4.302 Mobile Safari/537.36'
			);
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, device)).resolves.to.be.eq(false);
		});

		it('returns true when there is authentication from same device', async () => {
			const successfulAuth = generateSuccessfulAuthenticationModel(firstAccount, {
				nullify: ['id', 'location'],
				include: {
					device: generateDevice()
				}
			});
			expect(successfulAuth.device).toBeDefined();
			expect(successfulAuth.device).not.toBeNull();

			await successfulAuthenticationRepository.insert(successfulAuth);
			expect(typeof successfulAuth.id).to.be.eq('string');

			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, successfulAuth.device as HttpDevice)).resolves.to.be.eq(
				true
			);
		});
	});

	describe(`${SuccessfulAuthenticationsMysqlRepository.prototype.readRange.name} spec`, () => {
		it('returns empty array when there are no authentications', async () => {
			const successfulAuth = generateSuccessfulAuthenticationModel(secondAccount, {
				nullify: ['id', 'device', 'location']
			});
			await successfulAuthenticationRepository.insert(successfulAuth);

			expect(typeof successfulAuth.id).to.be.eq('string');

			const authentications = await successfulAuthenticationRepository.readRange(firstAccount.id); // FIRST
			expect(authentications).toStrictEqual([]);
		});

		it('returns all authentications for account', async () => {
			/* CREATE MODELS */
			const authentications = Array.from({ length: 20 }, () =>
				generateSuccessfulAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id']
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			const readAuthentications = await successfulAuthenticationRepository.readRange(firstAccount.id);
			const expectedAuthentications = authentications.filter((authentication) => authentication.accountId === firstAccount.id);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.have.length(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});

		it('returns authentications starting from unix timestamp', async () => {
			const now = chrono.unix();

			/* CREATE MODELS */
			const authentications = Array.from({ length: 20 }, () =>
				generateSuccessfulAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id'],
					include: { authenticatedAt: now - randomInt(1, 100) }
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			await expect(successfulAuthenticationRepository.readRange(firstAccount.id, now)).resolves.toStrictEqual([]);

			const startingFrom = now - randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await successfulAuthenticationRepository.readRange(accountId, startingFrom);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.authenticatedAt >= startingFrom
			);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.have.length(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});

		it('returns authentications ending with unix timestamp', async () => {
			const now = chrono.unix();

			/* CREATE MODELS */
			const authentications = Array.from({ length: 20 }, () =>
				generateSuccessfulAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id'],
					include: { authenticatedAt: now - randomInt(1, 100) }
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			await expect(successfulAuthenticationRepository.readRange(firstAccount.id, undefined, now - 101)).resolves.toStrictEqual([]);

			const endingTo = now - randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await successfulAuthenticationRepository.readRange(accountId, undefined, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.authenticatedAt <= endingTo
			);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.have.length(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});

		it('returns authentications starting from and ending to unix timestamps', async () => {
			const now = chrono.unix();

			/* CREATE MODELS */
			const authentications = Array.from({ length: 20 }, () =>
				generateSuccessfulAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id'],
					include: { authenticatedAt: now - randomInt(1, 100) }
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			await expect(successfulAuthenticationRepository.readRange(firstAccount.id, now - 102, now - 101)).resolves.toStrictEqual([]);

			const startingFrom = now - randomInt(50, 100);
			const endingTo = now - randomInt(1, 49);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await successfulAuthenticationRepository.readRange(accountId, startingFrom, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) =>
					authentication.accountId === accountId && authentication.authenticatedAt >= startingFrom && authentication.authenticatedAt <= endingTo
			);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.have.length(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});
	});
});
