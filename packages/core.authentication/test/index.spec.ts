import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import faker from 'faker';
import './bootstrap';
import { AccountStatus, AccountWithTotpSecret, SuccessfulAuthenticationModel } from '@thermopylae/lib.authentication';
import { chrono } from '@thermopylae/lib.utils';
import type { HttpDevice } from '@thermopylae/core.declarations';
import { AccountMySqlRepository, SuccessfulAuthenticationsMysqlRepository } from '../lib';

describe(`${SuccessfulAuthenticationsMysqlRepository.name} spec`, () => {
	const successfulAuthenticationRepository = new SuccessfulAuthenticationsMysqlRepository();
	const accountRepository = new AccountMySqlRepository();

	let account: AccountWithTotpSecret;
	beforeEach(async function () {
		account = {
			id: undefined!,
			username: faker.internet.userName(),
			passwordHash: faker.internet.password(),
			passwordAlg: faker.datatype.number(9),
			email: faker.internet.email(),
			disabledUntil: AccountStatus.DISABLED_UNTIL_ACTIVATION,
			mfa: faker.datatype.boolean(),
			totpSecret: faker.datatype.string()
		};
		await accountRepository.insert(account);
	});

	describe(`${SuccessfulAuthenticationsMysqlRepository.prototype.insert.name} spec`, () => {
		it('inserts authentication without device and location', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: account.id,
				ip: faker.internet.ip(),
				authenticatedAt: chrono.unixTime()
			};
			await successfulAuthenticationRepository.insert(successfulAuth);

			expect(successfulAuth.id).to.be.eq('1');
		});
	});

	describe.only(`${SuccessfulAuthenticationsMysqlRepository.prototype.authBeforeFromThisDevice.name} spec`, () => {
		it('returns false when there are no authentications at all', async () => {
			const device: HttpDevice = {
				device: {
					type: 'smartphone',
					brand: 'Android',
					model: '9'
				},
				bot: null,
				os: null,
				client: null
			};
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(account.id, device)).to.eventually.be.eq(false);
		});

		it('returns false when there is authentication without device', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: account.id,
				ip: faker.internet.ip(),
				authenticatedAt: chrono.unixTime()
			};
			await successfulAuthenticationRepository.insert(successfulAuth);
			expect(typeof successfulAuth.id).to.be.eq('string');

			const device: HttpDevice = {
				device: {
					type: 'smartphone',
					brand: 'Android',
					model: '9'
				},
				bot: null,
				os: null,
				client: null
			};
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(account.id, device)).to.eventually.be.eq(false);
		});

		it('returns false when there is authentication from different device', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: account.id,
				ip: faker.internet.ip(),
				device: {
					bot: null,
					os: null,
					device: {
						brand: 'iOS',
						model: '11',
						type: 'smartphone'
					},
					client: null
				},
				authenticatedAt: chrono.unixTime()
			};
			await successfulAuthenticationRepository.insert(successfulAuth);
			expect(typeof successfulAuth.id).to.be.eq('string');

			const device: HttpDevice = {
				device: {
					type: 'smartphone',
					brand: 'Android',
					model: '9'
				},
				bot: null,
				os: null,
				client: null
			};
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(account.id, device)).to.eventually.be.eq(false);
		});

		it('returns true when there is authentication from same device', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: account.id,
				ip: faker.internet.ip(),
				device: {
					bot: null,
					os: null,
					device: {
						brand: 'Android',
						model: '9',
						type: 'smartphone'
					},
					client: null
				},
				authenticatedAt: chrono.unixTime()
			};
			await successfulAuthenticationRepository.insert(successfulAuth);
			expect(typeof successfulAuth.id).to.be.eq('string');

			const device: HttpDevice = {
				device: {
					type: 'smartphone',
					brand: 'Android',
					model: '9'
				},
				bot: null,
				os: null,
				client: null
			};
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(account.id, device)).to.eventually.be.eq(true);
		});
	});
});
