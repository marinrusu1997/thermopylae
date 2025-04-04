import { chrono } from '@thermopylae/lib.utils';
import { randomInt } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountMySqlRepository, FailedAuthenticationsMysqlRepository } from '../../lib/index.js';
import { generateAccount, generateFailedAuthenticationModel } from '../fixtures/generator.js';

describe(`${FailedAuthenticationsMysqlRepository.name} spec`, function suite() {
	const failedAuthenticationRepository = new FailedAuthenticationsMysqlRepository();
	const accountRepository = new AccountMySqlRepository();

	const firstAccount = generateAccount();
	const secondAccount = generateAccount();

	beforeEach(async () => {
		await Promise.all([accountRepository.insert(firstAccount), accountRepository.insert(secondAccount)]);
	}, 2500);

	describe(`${FailedAuthenticationsMysqlRepository.prototype.insert.name} spec`, () => {
		it('inserts authentication without device and location', async () => {
			const failedAuthenticationModel = generateFailedAuthenticationModel(firstAccount, {
				nullify: ['id', 'device', 'location']
			});
			await failedAuthenticationRepository.insert(failedAuthenticationModel);

			expect(typeof failedAuthenticationModel.id).to.be.eq('string');
		});
	});

	describe(`${FailedAuthenticationsMysqlRepository.prototype.readRange.name} spec`, () => {
		it('returns empty array when there are no authentications', async () => {
			const failedAuth = generateFailedAuthenticationModel(secondAccount, {
				nullify: ['id', 'device', 'location']
			});
			await failedAuthenticationRepository.insert(failedAuth);

			expect(typeof failedAuth.id).to.be.eq('string');

			const authentications = await failedAuthenticationRepository.readRange(firstAccount.id); // FIRST
			expect(authentications).toStrictEqual([]);
		});

		it('returns all authentications for account', async () => {
			/* CREATE MODELS */
			const authentications = Array.from({ length: 20 }, () =>
				generateFailedAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id']
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			const readAuthentications = await failedAuthenticationRepository.readRange(firstAccount.id);
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
				generateFailedAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id'],
					include: {
						detectedAt: now - randomInt(1, 100)
					}
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			await expect(failedAuthenticationRepository.readRange(firstAccount.id, now)).resolves.toStrictEqual([]);

			const startingFrom = now - randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await failedAuthenticationRepository.readRange(accountId, startingFrom);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.detectedAt >= startingFrom
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
				generateFailedAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id'],
					include: {
						detectedAt: now - randomInt(1, 100)
					}
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			await expect(failedAuthenticationRepository.readRange(firstAccount.id, undefined, now - 101)).resolves.toStrictEqual([]);

			const endingTo = now - randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await failedAuthenticationRepository.readRange(accountId, undefined, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.detectedAt <= endingTo
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
				generateFailedAuthenticationModel(Math.random() > 0.5 ? secondAccount : firstAccount, {
					nullify: ['id'],
					include: {
						detectedAt: now - randomInt(1, 100)
					}
				})
			);

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			await expect(failedAuthenticationRepository.readRange(firstAccount.id, now - 102, now - 101)).resolves.toStrictEqual([]);

			const startingFrom = now - randomInt(50, 100);
			const endingTo = now - randomInt(1, 49);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await failedAuthenticationRepository.readRange(accountId, startingFrom, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.detectedAt >= startingFrom && authentication.detectedAt <= endingTo
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
