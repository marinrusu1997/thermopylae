// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import faker from 'faker';
import '../fixtures/bootstrap';
import { AccountStatus, AccountWithTotpSecret, FailedAuthenticationModel } from '@thermopylae/lib.authentication';
import { array, chrono, number } from '@thermopylae/lib.utils';
import { AccountMySqlRepository, FailedAuthenticationsMysqlRepository } from '../../lib';

describe(`${FailedAuthenticationsMysqlRepository.name} spec`, function suite() {
	this.timeout(2_500);

	const failedAuthenticationRepository = new FailedAuthenticationsMysqlRepository();
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

	describe(`${FailedAuthenticationsMysqlRepository.prototype.insert.name} spec`, () => {
		it('inserts authentication without device and location', async () => {
			const failedAuthenticationModel: FailedAuthenticationModel = {
				id: undefined!,
				accountId: firstAccount.id,
				ip: faker.internet.ip(),
				detectedAt: chrono.unixTime()
			};
			await failedAuthenticationRepository.insert(failedAuthenticationModel);

			expect(typeof failedAuthenticationModel.id).to.be.eq('string');
		});
	});

	describe(`${FailedAuthenticationsMysqlRepository.prototype.readRange.name} spec`, () => {
		it('returns empty array when there are no authentications', async () => {
			const failedAuth: FailedAuthenticationModel = {
				id: undefined!,
				accountId: secondAccount.id, // SECOND
				ip: faker.internet.ip(),
				detectedAt: chrono.unixTime()
			};
			await failedAuthenticationRepository.insert(failedAuth);

			expect(typeof failedAuth.id).to.be.eq('string');

			const authentications = await failedAuthenticationRepository.readRange(firstAccount.id); // FIRST
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
				detectedAt: chrono.unixTime()
			})) as FailedAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			const readAuthentications = await failedAuthenticationRepository.readRange(firstAccount.id);
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
				detectedAt: now - number.randomInt(1, 100)
			})) as FailedAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			expect(await failedAuthenticationRepository.readRange(firstAccount.id, now)).to.be.equalTo([]);

			const startingFrom = now - number.randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await failedAuthenticationRepository.readRange(accountId, startingFrom);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.detectedAt >= startingFrom
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
				detectedAt: now - number.randomInt(1, 100)
			})) as FailedAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			expect(await failedAuthenticationRepository.readRange(firstAccount.id, undefined, now - 101)).to.be.equalTo([]);

			const endingTo = now - number.randomInt(1, 100);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await failedAuthenticationRepository.readRange(accountId, undefined, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.detectedAt <= endingTo
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
				detectedAt: now - number.randomInt(1, 100)
			})) as FailedAuthenticationModel[];

			/* INSERT THEM */
			await Promise.all(authentications.map((authentication) => failedAuthenticationRepository.insert(authentication)));

			/* READ THEM */
			expect(await failedAuthenticationRepository.readRange(firstAccount.id, now - 102, now - 101)).to.be.equalTo([]);

			const startingFrom = now - number.randomInt(50, 100);
			const endingTo = now - number.randomInt(1, 49);
			const accountId = Math.random() > 0.5 ? secondAccount.id : firstAccount.id;

			const readAuthentications = await failedAuthenticationRepository.readRange(accountId, startingFrom, endingTo);
			const expectedAuthentications = authentications.filter(
				(authentication) => authentication.accountId === accountId && authentication.detectedAt >= startingFrom && authentication.detectedAt <= endingTo
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
