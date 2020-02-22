import { expect } from 'chai';
import { describe, it } from 'mocha';
import { AccountEntityMongo, FailedAuthAttemptsEntityMongo, AccessPointEntityMongo, ActiveUserSessionEntityMongo } from './fixtures/mongo-entities';
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
		const now = new Date().getTime();
		await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			timestamp: now,
			devices: ['device1'],
			ips: ['127.0.0.1']
		});
		const attempt2Id = await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			timestamp: now - 1000,
			devices: ['device1'],
			ips: ['127.0.0.1']
		});
		const attempt3Id = await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			timestamp: now - 5000,
			devices: ['device1'],
			ips: ['127.0.0.1']
		});
		const attempts = await FailedAuthAttemptsEntityMongo.readRange('1', now - 5000, now - 900);
		expect(attempts.length).to.be.equal(2);
		expect(attempts[0].id).to.be.oneOf([attempt2Id, attempt3Id]);
		expect(attempts[1].id).to.be.oneOf([attempt2Id, attempt3Id]);
	});

	it('access point', async () => {
		const now = new Date().getTime();
		await AccessPointEntityMongo.create({ timestamp: now, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		await AccessPointEntityMongo.create({ timestamp: now + 10, accountId: '2', ip: '127.0.0.1', device: 'Android A5', location });
		expect(await AccessPointEntityMongo.authBeforeFromThisDevice('1', 'Android S9')).to.be.equal(true);
		expect(await AccessPointEntityMongo.authBeforeFromThisDevice('1', 'Android A5')).to.be.equal(false);
		expect(await AccessPointEntityMongo.authBeforeFromThisDevice('2', 'Android A5')).to.be.equal(true);
	});

	it('active user session', async () => {
		const now = new Date().getTime();
		// user 1 has 3 active sessions ...
		await ActiveUserSessionEntityMongo.create({ timestamp: now, accountId: '1' });
		await ActiveUserSessionEntityMongo.create({ timestamp: now + 10, accountId: '1' });
		await ActiveUserSessionEntityMongo.create({ timestamp: now + 20, accountId: '1' });
		// ... and their corresponding access points
		await AccessPointEntityMongo.create({ timestamp: now, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		await AccessPointEntityMongo.create({ timestamp: now + 10, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		await AccessPointEntityMongo.create({ timestamp: now + 20, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location });
		// user 2 is not active, but has a previous access point
		await AccessPointEntityMongo.create({ timestamp: now - 10, accountId: '2', ip: '127.0.0.1', device: 'Android A5', location });

		// read active sessions of user 1 ...
		let activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(3);

		// user 2 is not logged
		const activeUserConnectionsUser2 = await ActiveUserSessionEntityMongo.readAll('2');
		expect(activeUserConnectionsUser2.length).to.be.equal(0);

		// delete one active session of user 1
		await ActiveUserSessionEntityMongo.delete('1', now);
		activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(2);

		// delete all sessions of user 1
		await ActiveUserSessionEntityMongo.deleteAll('1');
		activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(0);
	});
});
