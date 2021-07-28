import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import faker from 'faker';
import { AccountStatus, AccountWithTotpSecret, SuccessfulAuthenticationModel } from '@thermopylae/lib.authentication';
import { array, chrono, number } from '@thermopylae/lib.utils';
import type { HttpDevice } from '@thermopylae/core.declarations';
import { AccountMySqlRepository, SuccessfulAuthenticationsMysqlRepository } from '../../lib';

describe(`${SuccessfulAuthenticationsMysqlRepository.name} spec`, function suite() {
	this.timeout(2_500);

	const successfulAuthenticationRepository = new SuccessfulAuthenticationsMysqlRepository();
	const accountRepository = new AccountMySqlRepository();

	let firstAccount: AccountWithTotpSecret;
	let secondAccount: AccountWithTotpSecret;

	beforeEach(async function () {
		this.timeout(2_500);

		firstAccount = {
			id: undefined!,
			username: faker.internet.userName(),
			passwordHash: faker.internet.password(),
			passwordAlg: faker.datatype.number(9),
			email: faker.internet.email(),
			disabledUntil: AccountStatus.DISABLED_UNTIL_ACTIVATION,
			mfa: faker.datatype.boolean(),
			totpSecret: faker.datatype.string()
		};
		secondAccount = {
			id: undefined!,
			username: faker.internet.userName(),
			passwordHash: faker.internet.password(),
			passwordAlg: faker.datatype.number(9),
			email: faker.internet.email(),
			disabledUntil: AccountStatus.DISABLED_UNTIL_ACTIVATION,
			mfa: faker.datatype.boolean(),
			totpSecret: faker.datatype.string()
		};

		await Promise.all([accountRepository.insert(firstAccount), accountRepository.insert(secondAccount)]);
	});

	describe(`${SuccessfulAuthenticationsMysqlRepository.prototype.insert.name} spec`, () => {
		it('inserts authentication without device and location', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: firstAccount.id,
				ip: faker.internet.ip(),
				authenticatedAt: chrono.unixTime()
			};
			await successfulAuthenticationRepository.insert(successfulAuth);

			expect(typeof successfulAuth.id).to.be.eq('string');
		});
	});

	describe(`${SuccessfulAuthenticationsMysqlRepository.prototype.authBeforeFromThisDevice.name} spec`, () => {
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
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, device)).to.eventually.be.eq(false);
		});

		it('returns false when there is authentication without device', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: firstAccount.id,
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
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, device)).to.eventually.be.eq(false);
		});

		it('returns false when there is authentication from different device', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: firstAccount.id,
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
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, device)).to.eventually.be.eq(false);
		});

		it('returns true when there is authentication from same device', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: firstAccount.id,
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
			await expect(successfulAuthenticationRepository.authBeforeFromThisDevice(firstAccount.id, device)).to.eventually.be.eq(true);
		});
	});

	describe(`${SuccessfulAuthenticationsMysqlRepository.prototype.readRange.name} spec`, () => {
		it('returns empty array when there are no authentications', async () => {
			const successfulAuth: SuccessfulAuthenticationModel = {
				id: undefined!,
				accountId: secondAccount.id, // SECOND
				ip: faker.internet.ip(),
				authenticatedAt: chrono.unixTime()
			};
			await successfulAuthenticationRepository.insert(successfulAuth);

			expect(typeof successfulAuth.id).to.be.eq('string');

			const authentications = await successfulAuthenticationRepository.readRange(firstAccount.id); // FIRST
			expect(authentications).to.be.equalTo([]);
		});

		it('returns all authentications for account', async () => {
			/* CREATE MODELS */
			const authentications = array.filledWith(20, () => ({
				id: undefined!,
				accountId: Math.random() > 0.5 ? secondAccount.id : firstAccount.id,
				ip: faker.internet.ip(),
				device:
					Math.random() > 0.5
						? {
								device: {
									type: 'smartphone',
									brand: 'Android',
									model: '9'
								},
								bot: null,
								os: null,
								client: null
						  }
						: null,
				location:
					Math.random() < 0.5
						? {
								countryCode: 'MD',
								regionCode: 'FL',
								city: 'Pietrosu',
								timezone: 'Bucharest +2',
								longitude: 45.5,
								latitude: 46.6
						  }
						: null,
				authenticatedAt: chrono.unixTime()
			})) as SuccessfulAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			const readAuthentications = await successfulAuthenticationRepository.readRange(firstAccount.id);
			const expectedAuthentications = authentications.filter((authentication) => authentication.accountId === firstAccount.id);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.be.ofSize(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});

		it('returns authentications starting from unix timestamp', async () => {
			const now = chrono.unixTime();

			/* CREATE MODELS */
			const authentications = array.filledWith(20, () => ({
				id: undefined!,
				accountId: Math.random() > 0.5 ? secondAccount.id : firstAccount.id,
				ip: faker.internet.ip(),
				device:
					Math.random() > 0.5
						? {
								device: {
									type: 'smartphone',
									brand: 'Android',
									model: '9'
								},
								bot: null,
								os: null,
								client: null
						  }
						: null,
				location:
					Math.random() < 0.5
						? {
								countryCode: 'MD',
								regionCode: 'FL',
								city: 'Pietrosu',
								timezone: 'Bucharest +2',
								longitude: 45.5,
								latitude: 46.6
						  }
						: null,
				authenticatedAt: now - number.randomInt(1, 100)
			})) as SuccessfulAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			expect(await successfulAuthenticationRepository.readRange(firstAccount.id, now)).to.be.equalTo([]);

			const startingFrom = now - number.randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await successfulAuthenticationRepository.readRange(accountId, startingFrom);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.authenticatedAt >= startingFrom
			);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.be.ofSize(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});

		it('returns authentications ending with unix timestamp', async () => {
			const now = chrono.unixTime();

			/* CREATE MODELS */
			const authentications = array.filledWith(20, () => ({
				id: undefined!,
				accountId: Math.random() > 0.5 ? secondAccount.id : firstAccount.id,
				ip: faker.internet.ip(),
				device:
					Math.random() > 0.5
						? {
								device: {
									type: 'smartphone',
									brand: 'Android',
									model: '9'
								},
								bot: null,
								os: null,
								client: null
						  }
						: null,
				location:
					Math.random() < 0.5
						? {
								countryCode: 'MD',
								regionCode: 'FL',
								city: 'Pietrosu',
								timezone: 'Bucharest +2',
								longitude: 45.5,
								latitude: 46.6
						  }
						: null,
				authenticatedAt: now - number.randomInt(1, 100)
			})) as SuccessfulAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			expect(await successfulAuthenticationRepository.readRange(firstAccount.id, undefined, now - 101)).to.be.equalTo([]);

			const endingTo = now - number.randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await successfulAuthenticationRepository.readRange(accountId, undefined, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.authenticatedAt <= endingTo
			);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.be.ofSize(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});

		it('returns authentications starting from and ending to unix timestamps', async () => {
			const now = chrono.unixTime();

			/* CREATE MODELS */
			const authentications = array.filledWith(20, () => ({
				id: undefined!,
				accountId: Math.random() > 0.5 ? secondAccount.id : firstAccount.id,
				ip: faker.internet.ip(),
				device:
					Math.random() > 0.5
						? {
								device: {
									type: 'smartphone',
									brand: 'Android',
									model: '9'
								},
								bot: null,
								os: null,
								client: null
						  }
						: null,
				location:
					Math.random() < 0.5
						? {
								countryCode: 'MD',
								regionCode: 'FL',
								city: 'Pietrosu',
								timezone: 'Bucharest +2',
								longitude: 45.5,
								latitude: 46.6
						  }
						: null,
				authenticatedAt: now - number.randomInt(1, 100)
			})) as SuccessfulAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => successfulAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			expect(await successfulAuthenticationRepository.readRange(firstAccount.id, now - 102, now - 101)).to.be.equalTo([]);

			const startingFrom = now - number.randomInt(50, 100);
			const endingTo = now - number.randomInt(1, 49);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await successfulAuthenticationRepository.readRange(accountId, startingFrom, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) =>
					authentication.accountId === accountId && authentication.authenticatedAt >= startingFrom && authentication.authenticatedAt <= endingTo
			);

			readAuthentications.sort((first, second) => first.id.localeCompare(second.id));
			expectedAuthentications.sort((first, second) => first.id.localeCompare(second.id));

			expect(readAuthentications).to.be.ofSize(expectedAuthentications.length);

			for (let i = 0; i < expectedAuthentications.length; i++) {
				expect(readAuthentications[i]).to.be.deep.eq(expectedAuthentications[i]);
			}
		});
	});
});
