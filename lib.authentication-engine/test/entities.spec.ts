import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
	AccountEntityMongo,
	FailedAuthAttemptsEntityMongo,
	AuthenticationEntryPointEntityMongo,
	ActiveUserSessionEntityMongo
} from './fixtures/mongo-entities';
import { models } from '../lib';

describe('entities', () => {
	const location = {
		countryCode: 'US',
		regionCode: 'CA',
		city: 'Los Angeles',
		postalCode: '90067',
		timeZone: 'America/Los_Angeles',
		latitude: 34.0577507019043,
		longitude: -118.41380310058594
	};

	it('account', async () => {
		const account: models.AccountModel = {
			username: 'gigel',
			password: '123',
			salt: 'salt',
			hashingAlg: 1,
			role: 'admin',
			email: 'email',
			telephone: 'mobile',
			enabled: false,
			usingMfa: false,
			pubKey: 'does not matter now this key, just testing that account works'
		};

		account.id = await AccountEntityMongo.create(account);
		expect(await AccountEntityMongo.readById(account.id)).to.be.deep.equal(account);
		expect(await AccountEntityMongo.read(account.username)).to.be.deep.equal(account);
		await AccountEntityMongo.disable(account.id!);
		expect((await AccountEntityMongo.read(account.username))!.enabled).to.be.equal(false);
		await AccountEntityMongo.enable(account.id!);
		expect((await AccountEntityMongo.read(account.username))!.enabled).to.be.equal(true);
		await AccountEntityMongo.enableMultiFactorAuth(account.id!);
		expect((await AccountEntityMongo.read(account.username))!.usingMfa).to.be.equal(true);
		await AccountEntityMongo.disableMultiFactorAuth(account.id!);
		expect((await AccountEntityMongo.read(account.username))!.usingMfa).to.be.equal(false);
	});

	it('failed auth attempts', async () => {
		const now = new Date();
		await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			detectedAt: now,
			device: 'device1',
			ip: '127.0.0.1'
		});
		const attempt2Id = await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			detectedAt: new Date(now.getTime() - 1000),
			device: 'device1',
			ip: '127.0.0.1'
		});
		const attempt3Id = await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			detectedAt: new Date(now.getTime() - 5000),
			device: 'device1',
			ip: '127.0.0.1'
		});
		const attempts = await FailedAuthAttemptsEntityMongo.readRange('1', new Date(now.getTime() - 5000), new Date(now.getTime() - 900));
		expect(attempts.length).to.be.equal(2);
		expect(attempts[0].id).to.be.oneOf([attempt2Id, attempt3Id]);
		expect(attempts[1].id).to.be.oneOf([attempt2Id, attempt3Id]);
	});

	it('accessed point', async () => {
		const now = new Date().getTime();
		await AuthenticationEntryPointEntityMongo.create({ authenticatedAtUNIX: now, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		await AuthenticationEntryPointEntityMongo.create({ authenticatedAtUNIX: now + 10, accountId: '2', ip: '127.0.0.1', device: 'Android A5', location });
		expect(await AuthenticationEntryPointEntityMongo.authBeforeFromThisDevice('1', 'Android S9')).to.be.equal(true);
		expect(await AuthenticationEntryPointEntityMongo.authBeforeFromThisDevice('1', 'Android A5')).to.be.equal(false);
		expect(await AuthenticationEntryPointEntityMongo.authBeforeFromThisDevice('2', 'Android A5')).to.be.equal(true);
	});

	it('active user session', async () => {
		const now = new Date().getTime();
		// user 1 has 3 active sessions ...
		await ActiveUserSessionEntityMongo.create({ authenticatedAtUNIX: now, accountId: '1' });
		await ActiveUserSessionEntityMongo.create({ authenticatedAtUNIX: now + 10, accountId: '1' });
		await ActiveUserSessionEntityMongo.create({ authenticatedAtUNIX: now + 20, accountId: '1' });
		// ... and their corresponding accessed points
		await AuthenticationEntryPointEntityMongo.create({ authenticatedAtUNIX: now, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		await AuthenticationEntryPointEntityMongo.create({ authenticatedAtUNIX: now + 10, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		await AuthenticationEntryPointEntityMongo.create({ authenticatedAtUNIX: now + 20, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		// user 2 is not active, but has a previous accessed point
		await AuthenticationEntryPointEntityMongo.create({ authenticatedAtUNIX: now - 10, accountId: '2', ip: '127.0.0.1', device: 'Android A5', location });

		// read active sessions of user 1 ...
		let activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(3);

		// user 2 is not logged
		const activeUserConnectionsUser2 = await ActiveUserSessionEntityMongo.readAll('2');
		expect(activeUserConnectionsUser2.length).to.be.equal(0);

		// scheduleDeletion one active session of user 1
		await ActiveUserSessionEntityMongo.delete('1', now);
		activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(2);

		// scheduleDeletion all sessions of user 1
		await ActiveUserSessionEntityMongo.deleteAll('1');
		activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(0);
	});
});
