import { expect } from 'chai';
import { describe, it } from 'mocha';
import { AccountEntityMongo, FailedAuthAttemptsEntityMongo, AccessPointEntityMongo, ActiveUserSessionEntityMongo } from './fixtures/mongo-entities';

describe('entities', () => {
	it('account', async () => {
		const account = await AccountEntityMongo.create({
			username: 'gigel',
			password: '123',
			salt: 'salt',
			role: 'admin',
			email: 'email',
			telephone: 'mobile',
			activated: false,
			locked: false,
			mfa: false
		});
		expect(await AccountEntityMongo.readById(account.id!)).to.be.deep.equal(account);
		expect(await AccountEntityMongo.read(account.username)).to.be.deep.equal(account);
		await AccountEntityMongo.lock(account.id!);
		expect((await AccountEntityMongo.read(account.username))!.locked).to.be.equal(true);
		await AccountEntityMongo.activate(account.id!);
		expect((await AccountEntityMongo.read(account.username))!.activated).to.be.equal(true);
		await AccountEntityMongo.requireMfa(account.id!, true);
		expect((await AccountEntityMongo.read(account.username))!.mfa).to.be.equal(true);
	});

	it('failed auth attempts', async () => {
		const now = new Date().getTime();
		await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			timestamp: now,
			devices: 'device1',
			ips: '127.0.0.1'
		});
		const attempt2Id = await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			timestamp: now - 1000,
			devices: 'device1',
			ips: '127.0.0.1'
		});
		const attempt3Id = await FailedAuthAttemptsEntityMongo.create({
			accountId: '1',
			timestamp: now - 5000,
			devices: 'device1',
			ips: '127.0.0.1'
		});
		const attempts = await FailedAuthAttemptsEntityMongo.readRange('1', now - 5000, now - 900);
		expect(attempts.length).to.be.equal(2);
		expect(attempts[0].id).to.be.deep.eq(attempt2Id);
		expect(attempts[1].id).to.be.deep.eq(attempt3Id);
	});

	it('access point', async () => {
		const now = new Date().getTime();
		await AccessPointEntityMongo.create({ id: now, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location: 'Maldive' });
		await AccessPointEntityMongo.create({ id: now, accountId: '2', ip: '127.0.0.1', device: 'Android A5', location: 'Maldive' });
		expect(await AccessPointEntityMongo.authBeforeFromThisDevice('1', 'Android S9')).to.be.equal(true);
		expect(await AccessPointEntityMongo.authBeforeFromThisDevice('1', 'Android A5')).to.be.equal(false);
		expect(await AccessPointEntityMongo.authBeforeFromThisDevice('2', 'Android A5')).to.be.equal(true);
	});

	it('active user session', async () => {
		const now = new Date().getTime();
		// user 1 has 3 active sessions ...
		await ActiveUserSessionEntityMongo.create({ id: now, accountId: '1' });
		await ActiveUserSessionEntityMongo.create({ id: now + 10, accountId: '1' });
		await ActiveUserSessionEntityMongo.create({ id: now + 20, accountId: '1' });
		// ... and their corresponding access points
		await AccessPointEntityMongo.create({ id: now, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location: 'Maldive' });
		await AccessPointEntityMongo.create({ id: now + 10, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location: 'Maldive' });
		await AccessPointEntityMongo.create({ id: now + 20, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location: 'Maldive' });
		// user 2 is not active, but has a previous access point
		await AccessPointEntityMongo.create({ id: now, accountId: '2', ip: '127.0.0.1', device: 'Android A5', location: 'Maldive' });

		// read active sessions of user 1 ...
		let activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(3);
		// ... and check his access points
		expect(activeSessionsUser1[0]).to.be.deep.eq({ id: now, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location: 'Maldive' });
		expect(activeSessionsUser1[1]).to.be.deep.eq({ id: now + 10, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location: 'Maldive' });
		expect(activeSessionsUser1[2]).to.be.deep.eq({ id: now + 20, accountId: '1', ip: '127.0.0.1', device: 'Android S9', location: 'Maldive' });

		// user 2 is not logged
		const activeUserConnectionsUser2 = await ActiveUserSessionEntityMongo.readAll('2');
		expect(activeUserConnectionsUser2.length).to.be.equal(0);

		// delete one active session of user 1
		await ActiveUserSessionEntityMongo.delete(now);
		activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(2);

		// delete all sessions of user 1
		await ActiveUserSessionEntityMongo.deleteAll('1');
		activeSessionsUser1 = await ActiveUserSessionEntityMongo.readAll('1');
		expect(activeSessionsUser1.length).to.be.equal(0);
	});
});
