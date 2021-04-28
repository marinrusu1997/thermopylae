import { describe, it, before } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';
import { parse } from 'cookie';
import { setTimeout } from 'timers/promises';
import { CookieSessionManager, CookieSessionManagerOptions, initLogger, SessionOperationContext } from '../lib';
import { StorageMock } from './storage-mock';

function buildContext(): SessionOperationContext {
	return {
		ip: '127.0.0.1',
		'user-agent': 'Chrome 80',
		referer: 'https://www.my-site.com',
		location: 'Bucharest',
		device: {
			name: 'iPhone 11',
			type: 'MOBILE'
		}
	};
}

const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
function escapeStringRegexp(str: string): string {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}
	return str.replace(matchOperatorsRe, '\\$&');
}

describe(`${CookieSessionManager.name} spec`, () => {
	before(() => {
		LoggerInstance.console.createTransport({ level: 'info' });
		LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, true);
		initLogger();
	});

	it(`creates new session which expires after a given ttl`, async () => {
		const sessionManager = new CookieSessionManager({
			cookie: {
				maxAge: 1
			},
			storage: new StorageMock()
		});

		const sessionCookie = await sessionManager.create('uid1', buildContext());
		const sessionId = parse(sessionCookie)[sessionManager.sessionCookieName];
		expect(sessionId).to.be.of.length(24);

		const [session] = await sessionManager.read(sessionId, buildContext());
		expect(session.subject).to.be.eq('uid1');

		await setTimeout(1100);
		await expect(sessionManager.read(sessionId, buildContext())).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(CookieSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
	});

	it('denies access to session from device different than the one used at session creation', async () => {
		const sessionManager = new CookieSessionManager({
			cookie: {
				maxAge: 1
			},
			storage: new StorageMock()
		});

		const sessionCookie = await sessionManager.create('uid1', buildContext());
		const sessionId = parse(sessionCookie)[sessionManager.sessionCookieName];

		const otherDeviceContext: SessionOperationContext = {
			...buildContext(),
			device: {
				name: 'Android',
				type: 'MOBILE'
			}
		};
		await expect(sessionManager.read(sessionId, otherDeviceContext)).to.eventually.be.rejectedWith(
			new RegExp(
				`^Attempting to access session '${escapeStringRegexp(
					CookieSessionManager.hash(sessionId)
				)}' of the subject 'uid1' from a device which differs from the one session was created\\.`
			)
		);
	});

	it('removes session after being idle', async () => {
		const sessionManager = new CookieSessionManager({
			cookie: {
				maxAge: 10
			},
			timeouts: {
				idle: 2,
				renewal: 5,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage: new StorageMock()
		});

		const sessionCookie = await sessionManager.create('uid1', buildContext());
		const sessionId = parse(sessionCookie)[sessionManager.sessionCookieName];

		const [session] = await sessionManager.read(sessionId, buildContext());
		expect(session.subject).to.be.eq('uid1');
		const accessedAtSnapshot = session.accessedAt;

		await setTimeout(1000);
		await sessionManager.read(sessionId, buildContext());
		expect(session.accessedAt).to.not.be.eq(accessedAtSnapshot);

		await setTimeout(2100);
		await expect(sessionManager.read(sessionId, buildContext())).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(CookieSessionManager.hash(sessionId))}' it's expired, because it was idle`)
		);
	}).timeout(3500);

	it('renews session only once from same NodeJS process', async () => {
		const sessionManager = new CookieSessionManager({
			cookie: {
				maxAge: 10
			},
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage: new StorageMock()
		});
		const context = buildContext();

		const sessionCookie = await sessionManager.create('uid1', context);
		const sessionId = parse(sessionCookie)[sessionManager.sessionCookieName];
		const [session] = await sessionManager.read(sessionId, context);

		await setTimeout(1000);
		const [[session1, renewSessionCookie1], [session2, renewSessionCookie2]] = await Promise.all([
			sessionManager.read(sessionId, context),
			sessionManager.read(sessionId, context)
		]);
		expect(session1).to.be.deep.equal(session);
		expect(session2).to.be.deep.equal(session);

		const renewedSessionCookie = (renewSessionCookie1 || renewSessionCookie2)!;

		const renewedSessionId = parse(renewedSessionCookie)[sessionManager.sessionCookieName];
		const [renewedSession] = await sessionManager.read(renewedSessionId, context);
		expect(renewedSession.subject).to.be.eq('uid1');

		if (renewedSessionCookie === renewSessionCookie1) {
			expect(renewSessionCookie2).to.be.eq(null);
		} else {
			expect(renewSessionCookie1).to.be.eq(null);
		}

		await setTimeout(1100);
		await expect(sessionManager.read(sessionId, context)).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(CookieSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
	}).timeout(2500);

	it('renews session only once from multiple NodeJS processes', async () => {
		const storage = new StorageMock();
		const context = buildContext();
		const options: CookieSessionManagerOptions = {
			cookie: {
				maxAge: 10
			},
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage
		};

		const process1 = new CookieSessionManager(options);
		const process2 = new CookieSessionManager(options);

		const sessionCookie = await process1.create('uid1', context);
		const sessionId = parse(sessionCookie)[process1.sessionCookieName];
		const [session] = await process2.read(sessionId, context);

		await setTimeout(1000);
		const [[session1, renewSessionCookie1], [session2, renewSessionCookie2]] = await Promise.all([
			process1.read(sessionId, context),
			process2.read(sessionId, context)
		]);
		expect(session1).to.be.deep.equal(session);
		expect(session2).to.be.deep.equal(session);

		const renewedSessionCookie = (renewSessionCookie1 || renewSessionCookie2)!;

		const renewedSessionId = parse(renewedSessionCookie)[process2.sessionCookieName];
		const [renewedSession] = await process2.read(renewedSessionId, context);
		expect(renewedSession.subject).to.be.eq('uid1');

		if (renewedSessionCookie === renewSessionCookie1) {
			expect(renewSessionCookie2).to.be.eq(null);
		} else {
			expect(renewSessionCookie1).to.be.eq(null);
		}

		await setTimeout(1100);
		await expect(process1.read(sessionId, context)).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(CookieSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
		await expect(process2.read(sessionId, context)).to.eventually.be.rejectedWith(
			new RegExp(`^Session '${escapeStringRegexp(CookieSessionManager.hash(sessionId))}' doesn't exist\\.`)
		);
	}).timeout(2500);

	it('deletes explicitly user session that was recently renewed', async () => {
		const storage = new StorageMock();
		const sessionManager = new CookieSessionManager({
			cookie: {
				maxAge: 10
			},
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage
		});
		const context = buildContext();

		const sessionCookie = await sessionManager.create('uid1', context);
		const sessionId = parse(sessionCookie)[sessionManager.sessionCookieName];

		await setTimeout(1000);
		const [, renewedSessionCookie] = await sessionManager.read(sessionId, context);
		expect(renewedSessionCookie).to.not.be.eq(null); // renew performed

		await sessionManager.delete(sessionId);
		await setTimeout(1100);
		expect(storage.invocations.get('delete')).to.be.eq(1);
	}).timeout(2500);

	it('deletes all user sessions', async () => {
		const storage = new StorageMock();
		const sessionManager = new CookieSessionManager({
			cookie: {
				maxAge: 10
			},
			timeouts: {
				renewal: 1,
				oldSessionAvailabilityTimeoutAfterRenewal: 1
			},
			storage
		});

		await sessionManager.create('uid1', { ...buildContext(), ip: '192.168.5.9' });
		await sessionManager.create('uid1', { ...buildContext(), ip: '192.168.5.10' });

		const sessions = await sessionManager.readAll('uid1');
		expect(sessions).to.be.ofSize(2);
		expect(sessions[0].ip).to.be.eq('192.168.5.9');
		expect(sessions[1].ip).to.be.eq('192.168.5.10');

		await expect(sessionManager.deleteAll('uid1')).to.eventually.be.eq(2);
		await expect(sessionManager.deleteAll('uid1')).to.eventually.be.eq(0);
	});
});
