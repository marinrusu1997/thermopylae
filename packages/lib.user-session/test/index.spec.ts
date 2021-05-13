import { describe, it, before } from 'mocha';
import { expect, logger, initLogger } from '@thermopylae/lib.unit-test';
import { LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';
import type { DeviceBase, UserSessionOperationContext } from '@thermopylae/lib.user-session.commons';
import { setTimeout } from 'timers/promises';
import { UserSessionManager, UserSessionManagerOptions } from '../lib';
import { StorageMock } from './storage-mock';

function buildContext(): UserSessionOperationContext<DeviceBase, string> {
	return {
		ip: '127.0.0.1',
		device: {
			name: 'iPhone 11',
			type: 'smartphone'
		},
		location: 'Bucharest'
	};
}

const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
function escapeStringRegexp(str: string): string {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}
	return str.replace(matchOperatorsRe, '\\$&');
}

describe(`${UserSessionManager.name} spec`, () => {
	before(() => {
		LoggerInstance.console.createTransport({ level: 'info' });
		LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, { colorize: true });
		initLogger();
	});

	it(`creates new session which expires after a given ttl`, async () => {
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 1,
			storage: new StorageMock(),
			logger
		});

		const currentTimestamp = UserSessionManager.currentTimestamp();
		const sessionId = await sessionManager.create('uid1', buildContext());
		expect(sessionId).to.be.of.length(24);

		const [session] = await sessionManager.read('uid1', sessionId, buildContext());
		expect(session.ip).to.be.eq('127.0.0.1');
		expect(session.expiresAt).to.be.greaterThan(currentTimestamp);
		expect(session.expiresAt).to.be.lessThan(currentTimestamp + 3); // rounding to 3

		await setTimeout(1100);
		await expect(sessionManager.read('uid1', sessionId, buildContext())).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(UserSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
	});

	it('denies access to session from device different than the one used at session creation', async () => {
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 1,
			storage: new StorageMock(),
			logger
		});

		const sessionId = await sessionManager.create('uid1', buildContext());

		const otherDeviceContext: UserSessionOperationContext<DeviceBase, string> = {
			...buildContext(),
			device: {
				name: 'Android',
				type: 'MOBILE'
			}
		};
		await expect(sessionManager.read('uid1', sessionId, otherDeviceContext)).to.eventually.be.rejectedWith(
			new RegExp(
				`^Attempting to access session '${escapeStringRegexp(
					UserSessionManager.hash(sessionId)
				)}' of the subject 'uid1' from a device which differs from the one session was created\\.`
			)
		);
	});

	it('removes session after being idle', async () => {
		const storage = new StorageMock();
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 10,
			timeouts: {
				idle: 2,
				renewal: 5,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage,
			logger
		});

		const sessionId = await sessionManager.create('uid1', buildContext());

		const [session] = await sessionManager.read('uid1', sessionId, buildContext());
		expect(session.location).to.be.eq('Bucharest');

		await setTimeout(1000);
		const [updateSession] = await sessionManager.read('uid1', sessionId, buildContext());
		expect(updateSession.accessedAt).to.be.eq(session.accessedAt); // because it returns the accessedAt from last read
		expect((await storage.read('uid1', sessionId))!.accessedAt).to.not.be.eq(session.accessedAt);
		expect((await storage.read('uid1', sessionId))!.accessedAt).to.not.be.eq(updateSession.accessedAt);

		await setTimeout(2100);
		await expect(sessionManager.read('uid1', sessionId, buildContext())).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(UserSessionManager.hash(sessionId))}' it's expired, because it was idle`)
		);
	}).timeout(3500);

	it('renews session only once from same NodeJS process', async () => {
		const storage = new StorageMock();
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 10,
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage,
			logger
		});
		const context = buildContext();

		const sessionId = await sessionManager.create('uid1', context);
		const [session] = await sessionManager.read('uid1', sessionId, context);
		expect(storage.invocations.get('updateAccessedAt')).to.be.eq(1);

		await setTimeout(1000);
		const [[session1, renewSessionId1], [session2, renewSessionId2]] = await Promise.all([
			sessionManager.read('uid1', sessionId, context),
			sessionManager.read('uid1', sessionId, context)
		]);
		expect(storage.invocations.get('updateAccessedAt')).to.be.eq(2);

		expect(session1.accessedAt).to.be.equal(session.accessedAt);
		expect(session2.accessedAt).to.be.equal(session.accessedAt);

		const renewedSessionId = (renewSessionId1 || renewSessionId2)!;
		const [renewedSession] = await sessionManager.read('uid1', renewedSessionId, context);
		expect(renewedSession.device!.type).to.be.eq('smartphone');

		if (renewedSessionId === renewSessionId1) {
			expect(renewSessionId2).to.be.eq(null);
		} else {
			expect(renewSessionId1).to.be.eq(null);
		}

		await setTimeout(1100);
		await expect(sessionManager.read('uid1', sessionId, context)).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(UserSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
	}).timeout(2500);

	it('renews session only once from multiple NodeJS processes', async () => {
		const storage = new StorageMock();
		const context = buildContext();

		function createOptions(): UserSessionManagerOptions<DeviceBase, string> {
			return {
				idLength: 18,
				sessionTtl: 10,
				timeouts: {
					renewal: 1,
					oldSessionAvailabilityTimeoutAfterRenewal: 1
				},
				storage,
				logger
			};
		}

		const process1 = new UserSessionManager(createOptions());
		const process2 = new UserSessionManager(createOptions());

		const sessionId = await process1.create('uid1', context);
		const [session] = await process2.read('uid1', sessionId, context);

		await setTimeout(1000);
		const [[session1, renewSessionId1], [session2, renewSessionId2]] = await Promise.all([
			process1.read('uid1', sessionId, context),
			process2.read('uid1', sessionId, context)
		]);
		expect(session1).to.be.deep.equal(session);
		expect(session2).to.be.deep.equal(session);

		const renewedSessionId = (renewSessionId1 || renewSessionId2)!;
		const [renewedSession] = await process2.read('uid1', renewedSessionId, context);
		expect(renewedSession.location).to.be.eq('Bucharest');

		if (renewedSessionId === renewSessionId1) {
			expect(renewSessionId2).to.be.eq(null);
		} else {
			expect(renewSessionId1).to.be.eq(null);
		}

		await setTimeout(1100);
		await expect(process1.read('uid1', sessionId, context)).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(UserSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
		await expect(process2.read('uid1', sessionId, context)).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(UserSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
	}).timeout(2500);

	it('deletes explicitly user session that was recently renewed', async () => {
		const storage = new StorageMock();
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 10,
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage,
			logger
		});
		const context = buildContext();

		const sessionId = await sessionManager.create('uid1', context);

		await setTimeout(1000);
		const [, renewedSessionId] = await sessionManager.read('uid1', sessionId, context);
		expect(renewedSessionId).to.not.be.eq(null); // renew performed

		await sessionManager.delete('uid1', sessionId);
		await setTimeout(1100);
		expect(storage.invocations.get('delete')).to.be.eq(1);
	}).timeout(2500);

	it('deletes all user sessions', async () => {
		const storage = new StorageMock();
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 10,
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage,
			logger
		});

		const currentTimestamp = UserSessionManager.currentTimestamp();
		await sessionManager.create('uid1', { ...buildContext(), ip: '192.168.5.9' }, 2);
		await sessionManager.create('uid1', { ...buildContext(), ip: '192.168.5.10' }, 2);

		const sessions = await sessionManager.readAll('uid1');
		expect(sessions.size).to.be.eq(2);

		for (const session of sessions.values()) {
			expect(session.expiresAt).to.be.greaterThan(currentTimestamp);
			expect(session.expiresAt).to.be.lessThan(currentTimestamp + 4); // rounding to 4
			expect(session.ip).to.be.oneOf(['192.168.5.9', '192.168.5.10']);
		}

		await expect(sessionManager.deleteAll('uid1')).to.eventually.be.eq(2);
		await expect(sessionManager.deleteAll('uid1')).to.eventually.be.eq(0);
	});
});
