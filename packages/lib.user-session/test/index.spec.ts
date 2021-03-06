// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, before } from 'mocha';
import { expect, logger, initLogger } from '@thermopylae/dev.unit-test';
import { LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import type { DeviceBase, UserSessionOperationContext } from '@thermopylae/lib.user-session.commons';
import { setTimeout } from 'timers/promises';
import { RenewSessionHooks, UserSessionManager, UserSessionManagerOptions } from '../lib';
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

const renewSessionHooks: RenewSessionHooks = {
	onRenewMadeAlreadyFromCurrentProcess(sessionId: string) {
		logger.warning(
			`Can't renew session '${UserSessionManager.hash(sessionId)}', because it was renewed already. Renew has been made from this NodeJS process.`
		);
	},
	onRenewMadeAlreadyFromAnotherProcess(sessionId: string) {
		logger.warning(
			`Can't renew session '${UserSessionManager.hash(sessionId)}', because it was renewed already. Renew has been made from another NodeJS process.`
		);
	},
	onOldSessionDeleteFailure(sessionId: string, e: Error) {
		logger.error(`Failed to delete renewed session '${UserSessionManager.hash(sessionId)}'.`, e);
	}
};

describe(`${UserSessionManager.name} spec`, () => {
	before(() => {
		LoggerManagerInstance.console.createTransport({ level: 'info' });
		LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, { colorize: true });
		initLogger();
	});

	it(`creates new session which expires after a given ttl`, async () => {
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 1,
			storage: new StorageMock(),
			renewSessionHooks
		});

		const currentTimestamp = UserSessionManager.currentTimestamp();
		const sessionId = await sessionManager.create('uid1', buildContext());
		expect(sessionId).to.be.of.length(24);

		const [session] = await sessionManager.read('uid1', sessionId, buildContext());
		expect(session.ip).to.be.eq('127.0.0.1');
		expect(session.expiresAt).to.be.greaterThan(currentTimestamp);
		expect(session.expiresAt).to.be.lessThan(currentTimestamp + 3); // rounding to 3

		await setTimeout(1100, { ref: true });
		await expect(sessionManager.read('uid1', sessionId, buildContext())).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(UserSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
	});

	it('denies access to session from device different than the one used at session creation', async () => {
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 1,
			storage: new StorageMock(),
			renewSessionHooks
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
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 10,
			timeouts: {
				idle: 2,
				renewal: 5,
				oldSessionAvailabilityAfterRenewal: 1
			},
			storage: new StorageMock(),
			renewSessionHooks
		});

		const sessionId = await sessionManager.create('uid1', buildContext());

		const [session] = await sessionManager.read('uid1', sessionId, buildContext());
		expect(session.location).to.be.eq('Bucharest');
		const accessedAtSnapshot = session.accessedAt;

		await setTimeout(1000, { ref: true });
		await sessionManager.read('uid1', sessionId, buildContext());
		expect(session.accessedAt).to.not.be.eq(accessedAtSnapshot);

		await setTimeout(2100, { ref: true });
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
				oldSessionAvailabilityAfterRenewal: 1
			},
			storage,
			renewSessionHooks
		});
		const context = buildContext();

		const sessionId = await sessionManager.create('uid1', context);
		const [session] = await sessionManager.read('uid1', sessionId, context);
		expect(storage.invocations.get('updateAccessedAt')).to.be.eq(1);

		await setTimeout(1000, { ref: true });
		const [[session1, renewSessionId1], [session2, renewSessionId2]] = await Promise.all([
			sessionManager.read('uid1', sessionId, context),
			sessionManager.read('uid1', sessionId, context)
		]);
		// it updated accessed at only for first read op, the second saw that renew has been made already
		// and didn't reached updateAccessedAt operation
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

		await setTimeout(1100, { ref: true });
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
					oldSessionAvailabilityAfterRenewal: 1
				},
				storage,
				renewSessionHooks
			};
		}

		const process1 = new UserSessionManager(createOptions());
		const process2 = new UserSessionManager(createOptions());

		const sessionId = await process1.create('uid1', context);
		const [session] = await process2.read('uid1', sessionId, context);

		await setTimeout(1000, { ref: true });
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

		await setTimeout(1100, { ref: true });
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
				oldSessionAvailabilityAfterRenewal: 1
			},
			storage,
			renewSessionHooks
		});
		const context = buildContext();

		const sessionId = await sessionManager.create('uid1', context);

		await setTimeout(1000, { ref: true });
		const [, renewedSessionId] = await sessionManager.read('uid1', sessionId, context);
		expect(renewedSessionId).to.not.be.eq(null); // renew performed

		await sessionManager.delete('uid1', sessionId);
		await setTimeout(1100, { ref: true });
		expect(storage.invocations.get('delete')).to.be.eq(1);
	}).timeout(2500);

	it('deletes all user sessions', async () => {
		const storage = new StorageMock();
		const sessionManager = new UserSessionManager({
			idLength: 18,
			sessionTtl: 10,
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityAfterRenewal: 1
			},
			storage,
			renewSessionHooks
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
