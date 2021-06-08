import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { chrono } from '@thermopylae/lib.utils';
import type { HttpDevice, HTTPRequestLocation } from '@thermopylae/core.declarations';
import { AccountStatus, AccountWithTotpSecret, FailedAuthenticationModel } from '../lib';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';
import { FailedAuthenticationAttemptsRepositoryMongo } from './fixtures/repositories/mongo/failed-auth';
import { SuccessfulAuthenticationsRepositoryMongo } from './fixtures/repositories/mongo/successful-auth';

describe('Repositories spec', () => {
	const location: HTTPRequestLocation = {
		countryCode: 'US',
		regionCode: 'CA',
		city: 'Los Angeles',
		timezone: 'America/Los_Angeles',
		latitude: 34.0577507019043,
		longitude: -118.41380310058594
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
			id: undefined!,
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
		expect(await AccountRepositoryMongo.readById(account.id)).to.be.deep.equal(account);
		expect(await AccountRepositoryMongo.readByUsername(account.username)).to.be.deep.equal(account);
		expect(await AccountRepositoryMongo.readByEmail(account.email)).to.be.deep.equal(account);
		expect(await AccountRepositoryMongo.readByTelephone(account.telephone!)).to.be.deep.equal(account);
		await AccountRepositoryMongo.setDisabledUntil(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION);
		expect((await AccountRepositoryMongo.readByUsername(account.username))!.disabledUntil).to.be.equal(AccountStatus.DISABLED_UNTIL_ACTIVATION);
		await AccountRepositoryMongo.setDisabledUntil(account.id, AccountStatus.ENABLED);
		expect((await AccountRepositoryMongo.readByUsername(account.username))!.disabledUntil).to.be.equal(AccountStatus.ENABLED);
		await AccountRepositoryMongo.update(account.id, { mfa: true });
		expect((await AccountRepositoryMongo.readByUsername(account.username))!.mfa).to.be.equal(true);
		await AccountRepositoryMongo.update(account.id, { mfa: false });
		expect((await AccountRepositoryMongo.readByUsername(account.username))!.mfa).to.be.equal(false);
	});

	it('failed authentication', async () => {
		const now = chrono.unixTime();

		const attempt1: FailedAuthenticationModel = {
			id: undefined!,
			accountId: '1',
			ip: '127.0.0.1',
			detectedAt: now
		};
		await FailedAuthenticationAttemptsRepositoryMongo.insert(attempt1);

		const attempt2 = {
			id: undefined!,
			accountId: '1',
			ip: '127.0.0.1',
			device: androidDevice,
			detectedAt: now - 1
		};
		await FailedAuthenticationAttemptsRepositoryMongo.insert(attempt2);

		const attempt3 = {
			id: undefined!,
			accountId: '1',
			ip: '127.0.0.1',
			location,
			detectedAt: now - 5
		};
		await FailedAuthenticationAttemptsRepositoryMongo.insert(attempt3);

		const attempts = await FailedAuthenticationAttemptsRepositoryMongo.readRange('1', attempt3.detectedAt, attempt2.detectedAt);

		expect(attempts).to.be.ofSize(2);
		expect(attempts[0]).to.be.deep.equal(attempt3);
		expect(attempts[1]).to.be.deep.equal(attempt2);
	});

	it('successful authentication', async () => {
		const now = chrono.unixTime();
		await SuccessfulAuthenticationsRepositoryMongo.insert({
			id: undefined!,
			accountId: '1',
			ip: '127.0.0.1',
			device: androidDevice,
			location,
			authenticatedAt: now
		});
		await SuccessfulAuthenticationsRepositoryMongo.insert({
			id: undefined!,
			accountId: '2',
			ip: '127.0.0.1',
			device: iosDevice,
			location,
			authenticatedAt: now + 10
		});
		expect(await SuccessfulAuthenticationsRepositoryMongo.authBeforeFromThisDevice('1', androidDevice)).to.be.equal(true);
		expect(await SuccessfulAuthenticationsRepositoryMongo.authBeforeFromThisDevice('1', iosDevice)).to.be.equal(false);
		expect(await SuccessfulAuthenticationsRepositoryMongo.authBeforeFromThisDevice('2', iosDevice)).to.be.equal(true);
	});
});
