import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { chrono } from '@thermopylae/lib.utils';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { PublicPrivateKeys } from '@thermopylae/core.declarations';
import { IssuedJwtPayload, JwtManagerEvents, JwtSessionManager, JwtSessionManagerOptions } from '../lib';
import { InvalidAccessTokensCacheAdapter } from './mocks/invalid-access-tokens-cache';
import { RefreshTokensStorageAdapter } from './mocks/refresh-tokens-storage';

function jwtSessionManagerOpts(accessTokenTtl: number, refreshTokenTtl: number, secret: string | Buffer | PublicPrivateKeys): JwtSessionManagerOptions {
	return {
		secret,
		signOptions: {
			algorithm: 'HS384',
			issuer: 'auth-server.com',
			audience: ['auth-server.com', 'rest-server.com'],
			expiresIn: accessTokenTtl
		},
		verifyOptions: {
			algorithms: ['HS384'],
			issuer: 'auth-server.com',
			audience: 'rest-server.com'
		},
		invalidationOptions: {
			refreshTokenTtl,
			refreshTokenLength: 20,
			invalidAccessTokensCache: new InvalidAccessTokensCacheAdapter(),
			refreshTokensStorage: new RefreshTokensStorageAdapter()
		}
	};
}

describe(`${JwtSessionManager.name} spec`, () => {
	it('creates sessions and renews them', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, 'secret'));

		const sessionTokens = await sessionManager.create({ role: 'admin' }, { subject: 'uid1' });
		expect(sessionTokens.accessToken.split('.').length).to.be.eq(3); // header, payload, signature
		expect(sessionTokens.refreshToken).to.be.of.length(20);

		/* After 1 sec */
		await chrono.sleep(1000);

		const accessTokenPayload = await sessionManager.read(sessionTokens.accessToken);
		expect(accessTokenPayload.anc).to.be.eq(sessionTokens.refreshToken.slice(0, 5));
		expect(accessTokenPayload.role).to.be.eq('admin');
		expect(accessTokenPayload.sub).to.be.eq('uid1');

		const refreshedAccessToken = await sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' });

		/* After 2 sec 100 ms */
		await chrono.sleep(1100);

		await expect(sessionManager.read(sessionTokens.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);

		const refreshedAccessTokenPayload = await sessionManager.read(refreshedAccessToken);
		expect(refreshedAccessTokenPayload.anc).to.be.eq(sessionTokens.refreshToken.slice(0, 5));
		expect(refreshedAccessTokenPayload.role).to.be.eq('admin');
		expect(refreshedAccessTokenPayload.sub).to.be.eq('uid1');

		// refresh token expires soon, but still can refresh another access token
		const lastRefreshedAccessToken = await sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' });
		await expect(sessionManager.read(lastRefreshedAccessToken)).to.eventually.have.property('role', 'admin');

		/* After 3 sec 100 ms */
		await chrono.sleep(1000);

		await expect(sessionManager.read(refreshedAccessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
		// expired refresh token
		await expect(sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);

		await expect(sessionManager.read('aa.bb.cc')).to.eventually.be.rejectedWith(JsonWebTokenError);
	}).timeout(3500);

	it('creates session with multiple access tokens and then invalidates them', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, Buffer.from('secret')));

		let invalidatedSessionEventPayload: IssuedJwtPayload | undefined;
		sessionManager.on(JwtManagerEvents.SESSION_INVALIDATED, (payload) => {
			invalidatedSessionEventPayload = payload;
		});

		// issue tokens at different time points
		const userSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' });
		await chrono.sleep(500);
		const secondAccessToken = await sessionManager.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' });
		await chrono.sleep(500);
		const thirdAccessToken = await sessionManager.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' });

		const secondUserSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' });

		// ensure they are still valid
		const firstJwtPayload = await sessionManager.read(userSession.accessToken);
		expect(firstJwtPayload.role).to.be.eq('user');
		await expect(sessionManager.read(secondAccessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.read(thirdAccessToken)).to.eventually.have.property('role', 'user');

		// destroy session
		await sessionManager.deleteOne(firstJwtPayload, userSession.refreshToken);
		expect(invalidatedSessionEventPayload).to.be.deep.eq(firstJwtPayload);

		/*
		 * |------------| 	refresh token
		 * |--------| 		1'st access
		 *   |--------| 	2'nd access
		 * 	   |--------| 	3'rd access
		 */

		// ensure access tokens are not valid
		await expect(sessionManager.read(userSession.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');
		await expect(sessionManager.read(secondAccessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');
		await expect(sessionManager.read(thirdAccessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');

		// ensure refresh token can't be used for session renewal
		await expect(sessionManager.update(userSession.refreshToken, { role: 'admin ' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);

		// try open another session
		const thirdUserSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' });

		await expect(sessionManager.read(secondUserSession.accessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.update(secondUserSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.a('string');

		await expect(sessionManager.read(thirdUserSession.accessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.update(thirdUserSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.a('string');
	});

	it('invalidates access tokens that have a lifetime longer than refresh token', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 1, 'secret'));

		let invalidatedSessionEventPayload: IssuedJwtPayload | undefined;
		sessionManager.on(JwtManagerEvents.SESSION_INVALIDATED, (payload) => {
			invalidatedSessionEventPayload = payload;
		});

		const userSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' });

		await chrono.sleep(1100);
		const accessTokenPayload = await sessionManager.read(userSession.accessToken);

		await expect(sessionManager.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);

		await sessionManager.deleteOne(accessTokenPayload, userSession.refreshToken);
		expect(invalidatedSessionEventPayload).to.be.deep.eq(accessTokenPayload);

		await expect(sessionManager.read(userSession.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');

		await chrono.sleep(1000);
		await expect(sessionManager.read(userSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
	}).timeout(2500);

	it('invalidates all of the user sessions', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, 'secret'));

		let invalidatedAllSessionsEventPayload: IssuedJwtPayload | undefined;
		sessionManager.on(JwtManagerEvents.ALL_SESSIONS_INVALIDATED, (payload) => {
			invalidatedAllSessionsEventPayload = payload;
		});

		const firstSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' });
		await chrono.sleep(500);
		const secondSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' });
		const adminSession = await sessionManager.create({ role: 'admin' }, { subject: 'uid2' });

		// both sessions are still valid
		await expect(sessionManager.read(firstSession.accessToken)).to.eventually.have.property('role', 'user');
		await expect(sessionManager.read(secondSession.accessToken)).to.eventually.have.property('role', 'user');

		// invalidate all of them
		const secondSessionPayload = await sessionManager.read(secondSession.accessToken);
		await expect(sessionManager.deleteAll(secondSessionPayload)).to.eventually.be.eq(2);
		expect(invalidatedAllSessionsEventPayload).to.be.deep.eq(secondSessionPayload);

		await expect(sessionManager.read(firstSession.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');
		await expect(sessionManager.update(firstSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);

		await expect(sessionManager.read(secondSession.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');
		await expect(sessionManager.update(secondSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);

		// try to open another user session later
		await chrono.sleep(1000);
		const thirdSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' });
		await expect(sessionManager.read(thirdSession.accessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.update(thirdSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.a('string');

		// admin session remains untouched
		await expect(sessionManager.read(adminSession.accessToken)).to.eventually.have.property('role', 'admin');

		await chrono.sleep(500);
		await expect(sessionManager.read(firstSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
		await chrono.sleep(500);
		await expect(sessionManager.read(secondSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
	}).timeout(3000);

	it('invalidates session in cluster mode', async () => {
		const node1Opts = jwtSessionManagerOpts(1, 2, 'secret');
		const node1 = new JwtSessionManager(node1Opts);

		const node2Opts = jwtSessionManagerOpts(1, 2, 'secret');
		// shared DB
		node2Opts.invalidationOptions.refreshTokensStorage = node1Opts.invalidationOptions.refreshTokensStorage;
		const node2 = new JwtSessionManager(node2Opts);
		node2.on(JwtManagerEvents.SESSION_INVALIDATED, (accessTokenPayload) => {
			// simulate that accessTokenPayload was sent by event bus
			node1.restrictOne(accessTokenPayload);
		});

		const userSession = await node1.create({ role: 'user' }, { subject: 'uid1' });
		await expect(node1.read(userSession.accessToken)).to.eventually.have.property('role', 'user');
		await expect(node2.read(userSession.accessToken)).to.eventually.have.property('sub', 'uid1');

		const accessTokenPayload = await node1.read(userSession.accessToken);
		await node2.deleteOne(accessTokenPayload, userSession.refreshToken);

		await expect(node1.read(userSession.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');
		await expect(node2.read(userSession.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');

		await expect(node1.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);
		await expect(node2.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);

		await chrono.sleep(1100);
		await expect(node1.read(userSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
		await expect(node2.read(userSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
	});

	it('invalidates all sessions in cluster mode', async () => {
		const node1Opts = jwtSessionManagerOpts(1, 2, 'secret');
		const node1 = new JwtSessionManager(node1Opts);

		const node2Opts = jwtSessionManagerOpts(1, 2, 'secret');
		// shared DB
		node2Opts.invalidationOptions.refreshTokensStorage = node1Opts.invalidationOptions.refreshTokensStorage;
		const node2 = new JwtSessionManager(node2Opts);
		node2.on(JwtManagerEvents.ALL_SESSIONS_INVALIDATED, (accessTokenPayload) => {
			// simulate that accessTokenPayload was sent by event bus
			node1.restrictAll(accessTokenPayload);
		});

		// create sessions
		const node1Session = await node1.create({ role: 'user' }, { subject: 'uid1' });
		const node2Session = await node2.create({ role: 'user' }, { subject: 'uid1' });

		// invalidate them
		const node1SessionPayload = await node1.read(node1Session.accessToken);
		await expect(node2.deleteAll(node1SessionPayload)).to.eventually.be.eq(2);

		// access tokens are no longer valid
		await expect(node1.read(node2Session.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');
		await expect(node2.read(node1Session.accessToken)).to.eventually.be.rejectedWith('Token was forcibly invalidated.');

		// refresh tokens are no longer valid
		await expect(node1.update(node2Session.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);
		await expect(node2.update(node1Session.refreshToken, { role: 'user' }, { subject: 'uid1' })).to.eventually.be.rejectedWith(
			/^Refresh token [a-f0-9]+ for subject uid1 doesn't exist\.$/
		);

		// creating new session should work
		await chrono.sleep(1000);
		const node1SecondSession = await node1.create({ role: 'user' }, { subject: 'uid1' });
		await expect(node1.read(node1SecondSession.accessToken)).to.eventually.have.property('role', 'user');
		await expect(node2.read(node1SecondSession.accessToken)).to.eventually.have.property('role', 'user');
	});
});
