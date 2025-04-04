import type { HTTPRequestLocation, HttpDevice } from '@thermopylae/core.declarations';
import { chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { AccountStatus, type AccountWithTotpSecret, type FailedAuthenticationModel } from '../lib/index.js';
import { AuthenticationEngineDefaultOptions } from './fixtures/index.js';

const {
	account: AccountRepositoryMongo,
	failedAuthenticationAttempts: FailedAuthenticationAttemptsRepositoryMongo,
	successfulAuthentications: SuccessfulAuthenticationsRepositoryMongo
} = AuthenticationEngineDefaultOptions.repositories;

describe('Repositories spec', () => {
	const location: HTTPRequestLocation = {
		countryCode: 'US',
		regionCode: 'CA',
		city: 'Los Angeles',
		timezone: 'America/Los_Angeles',
		latitude: 34.057_750_701_904_3,
		longitude: -118.413_803_100_585_94
	};
	const androidDevice: HttpDevice = {
		device: {
			type: 'smartphone',
			model: 'Android',
			brand: '9'
		},
		os: null,
		client: null,
		bot: null
	};
	const iosDevice: HttpDevice = {
		device: {
			type: 'smartphone',
			model: 'iOS',
			brand: '11'
		},
		os: null,
		client: null,
		bot: null
	};

	it('account', async () => {
		const account: AccountWithTotpSecret = {
			id: '',
			username: 'user',
			passwordHash: 'hash',
			passwordSalt: undefined,
			passwordAlg: 1,
			email: 'email',
			telephone: 'mobile',
			disabledUntil: AccountStatus.ENABLED,
			mfa: false,
			pubKey: 'does not matter now this key, just testing that account works',
			totpSecret: 'secret'
		};

		await AccountRepositoryMongo.insert(account);
		await expect(AccountRepositoryMongo.readById(account.id)).resolves.to.be.deep.equal(account);
		await expect(AccountRepositoryMongo.readByUsername(account.username)).resolves.to.be.deep.equal(account);
		await expect(AccountRepositoryMongo.readByEmail(account.email)).resolves.to.be.deep.equal(account);
		await expect(AccountRepositoryMongo.readByTelephone(account.telephone ?? '')).resolves.to.be.deep.equal(account);
		await AccountRepositoryMongo.setDisabledUntil(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION);
		expect((await AccountRepositoryMongo.readByUsername(account.username))?.disabledUntil).to.be.equal(AccountStatus.DISABLED_UNTIL_ACTIVATION);
		await AccountRepositoryMongo.setDisabledUntil(account.id, AccountStatus.ENABLED);
		expect((await AccountRepositoryMongo.readByUsername(account.username))?.disabledUntil).to.be.equal(AccountStatus.ENABLED);
		await AccountRepositoryMongo.update(account.id, { mfa: true });
		expect((await AccountRepositoryMongo.readByUsername(account.username))?.mfa).to.be.equal(true);
		await AccountRepositoryMongo.update(account.id, { mfa: false });
		expect((await AccountRepositoryMongo.readByUsername(account.username))?.mfa).to.be.equal(false);
	});

	it('failed authentication', async () => {
		const now = chrono.unix();

		const attempt1: FailedAuthenticationModel = {
			id: '',
			accountId: '1',
			ip: '127.0.0.1',
			detectedAt: now
		};
		await FailedAuthenticationAttemptsRepositoryMongo.insert(attempt1);

		const attempt2 = {
			id: '',
			accountId: '1',
			ip: '127.0.0.1',
			device: androidDevice,
			detectedAt: now - 1
		};
		await FailedAuthenticationAttemptsRepositoryMongo.insert(attempt2);

		const attempt3 = {
			id: '',
			accountId: '1',
			ip: '127.0.0.1',
			location,
			detectedAt: now - 5
		};
		await FailedAuthenticationAttemptsRepositoryMongo.insert(attempt3);

		const attempts = await FailedAuthenticationAttemptsRepositoryMongo.readRange('1', attempt3.detectedAt, attempt2.detectedAt);

		expect(attempts).to.have.length(2);
		expect(attempts[0]).to.be.deep.equal(attempt3);
		expect(attempts[1]).to.be.deep.equal(attempt2);
	});

	it('successful authentication', async () => {
		const now = chrono.unix();
		await SuccessfulAuthenticationsRepositoryMongo.insert({
			id: '',
			accountId: '1',
			ip: '127.0.0.1',
			device: androidDevice,
			location,
			authenticatedAt: now
		});
		await SuccessfulAuthenticationsRepositoryMongo.insert({
			id: '',
			accountId: '2',
			ip: '127.0.0.1',
			device: iosDevice,
			location,
			authenticatedAt: now + 10
		});
		await expect(SuccessfulAuthenticationsRepositoryMongo.authBeforeFromThisDevice('1', androidDevice)).resolves.to.be.equal(true);
		await expect(SuccessfulAuthenticationsRepositoryMongo.authBeforeFromThisDevice('1', iosDevice)).resolves.to.be.equal(false);
		await expect(SuccessfulAuthenticationsRepositoryMongo.authBeforeFromThisDevice('2', iosDevice)).resolves.to.be.equal(true);
	});
});
