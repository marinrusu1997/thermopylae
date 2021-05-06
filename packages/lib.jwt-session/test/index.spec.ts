import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { setTimeout } from 'timers/promises';
import type { MutableSome, PublicPrivateKeys } from '@thermopylae/core.declarations';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import {
	IssuedJwtPayload,
	JwtManagerEvent,
	JwtSessionManager,
	JwtSessionManagerOptions,
	DeviceBase,
	UserSessionOperationContext,
	InvalidationStrategyOptions
} from '../lib';
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
			refreshTokenLength: 15,
			invalidAccessTokensCache: new InvalidAccessTokensCacheAdapter(),
			refreshTokensStorage: new RefreshTokensStorageAdapter()
		}
	};
}

function sessionContext(): UserSessionOperationContext<DeviceBase, string> {
	return {
		ip: '127.0.0.1',
		device: {
			name: 'iPhone 11',
			type: 'smartphone'
		},
		location: 'Bucharest'
	};
}

describe(`${JwtSessionManager.name} spec`, () => {
	it('creates sessions and renews them', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, 'secret'));

		const sessionTokens = await sessionManager.create({ role: 'admin' }, { subject: 'uid1' }, sessionContext());
		expect(sessionTokens.accessToken.split('.').length).to.be.eq(3); // header, payload, signature
		expect(sessionTokens.refreshToken).to.be.of.length(20);

		/* After 1 sec */
		await setTimeout(1000);

		const accessTokenPayload = await sessionManager.read(sessionTokens.accessToken);
		expect(accessTokenPayload.anc).to.be.eq(sessionTokens.refreshToken.slice(0, 5));
		expect(accessTokenPayload.role).to.be.eq('admin');
		expect(accessTokenPayload.sub).to.be.eq('uid1');

		const refreshedAccessToken = await sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' }, sessionContext());

		/* After 2 sec 100 ms */
		await setTimeout(1100);

		await expect(sessionManager.read(sessionTokens.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);

		const refreshedAccessTokenPayload = await sessionManager.read(refreshedAccessToken);
		expect(refreshedAccessTokenPayload.anc).to.be.eq(sessionTokens.refreshToken.slice(0, 5));
		expect(refreshedAccessTokenPayload.role).to.be.eq('admin');
		expect(refreshedAccessTokenPayload.sub).to.be.eq('uid1');

		// refresh token expires soon, but still can refresh another access token
		const lastRefreshedAccessToken = await sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' }, sessionContext());
		await expect(sessionManager.read(lastRefreshedAccessToken)).to.eventually.have.property('role', 'admin');

		/* After 3 sec 100 ms */
		await setTimeout(1000);

		await expect(sessionManager.read(refreshedAccessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
		// expired refresh token
		await expect(sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);

		await expect(sessionManager.read('aa.bb.cc')).to.eventually.be.rejectedWith(JsonWebTokenError);
	}).timeout(3500);

	it('fails to renew session from device that differs from the one session was created', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, 'secret'));
		const sessionTokens = await sessionManager.create({ role: 'admin' }, { subject: 'uid1' }, sessionContext());

		const differentContext = sessionContext();
		(differentContext as MutableSome<UserSessionOperationContext<DeviceBase, string>, 'device'>).device = {
			name: 'Android',
			type: 'smartphone'
		};
		await expect(sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' }, differentContext)).to.eventually.be.rejectedWith(
			/context that differs from user session metadata/
		);
	});

	it("doesn't verify devices if it wasn't provided at session creation or session update", async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, 'secret'));

		const firstSession = await sessionManager.create({ role: 'admin' }, { subject: 'uid1' }, { ip: '127.0.0.1', location: 'Amsterdam' });
		await expect(
			sessionManager.update(
				firstSession.refreshToken,
				{ role: 'admin' },
				{ subject: 'uid1' },
				{ ip: '192.2.3.5', device: { name: 'Android', type: 'smartphone' }, location: 'Bucharest' }
			)
		).to.eventually.match(/^[a-zA-Z0-9\-_.]+$/);

		const secondSession = await sessionManager.create(
			{ role: 'admin' },
			{ subject: 'uid1' },
			{ ip: '185.9.6.3', device: { name: 'Android', type: 'smartphone' }, location: 'Amsterdam' }
		);
		await expect(
			sessionManager.update(secondSession.refreshToken, { role: 'admin' }, { subject: 'uid1' }, { ip: '127.0.0.1', location: 'Bucharest' })
		).to.eventually.match(/^[a-zA-Z0-9\-_.]+$/);
	});

	it('creates session with multiple access tokens and then invalidates them', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, Buffer.from('secret')));

		let invalidatedSessionEventPayload: IssuedJwtPayload | undefined;
		sessionManager.on(JwtManagerEvent.SESSION_INVALIDATED, (payload) => {
			invalidatedSessionEventPayload = payload;
		});

		// issue tokens at different time points
		const userSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());
		await setTimeout(500);
		const secondAccessToken = await sessionManager.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext());
		await setTimeout(500);
		const thirdAccessToken = await sessionManager.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext());

		const secondUserSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());

		// ensure they are still valid
		const firstJwtPayload = await sessionManager.read(userSession.accessToken);
		expect(firstJwtPayload.role).to.be.eq('user');
		await expect(sessionManager.read(secondAccessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.read(thirdAccessToken)).to.eventually.have.property('role', 'user');

		// destroy session
		await sessionManager.deleteOne(firstJwtPayload.sub, userSession.refreshToken, firstJwtPayload);
		expect(invalidatedSessionEventPayload).to.be.deep.eq(firstJwtPayload);

		/*
		 * |------------| 	refresh token
		 * |--------| 		1'st access
		 *   |--------| 	2'nd access
		 * 	   |--------| 	3'rd access
		 */

		// ensure access tokens are not valid
		await expect(sessionManager.read(userSession.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);
		await expect(sessionManager.read(secondAccessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);
		await expect(sessionManager.read(thirdAccessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);

		// ensure refresh token can't be used for session renewal
		await expect(sessionManager.update(userSession.refreshToken, { role: 'admin ' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);

		// try open another session
		const thirdUserSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());

		await expect(sessionManager.read(secondUserSession.accessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.update(secondUserSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.a(
			'string'
		);

		await expect(sessionManager.read(thirdUserSession.accessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.update(thirdUserSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.a(
			'string'
		);
	});

	it('invalidates access tokens that have a lifetime longer than refresh token', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 1, 'secret'));

		let invalidatedSessionEventPayload: IssuedJwtPayload | undefined;
		sessionManager.on(JwtManagerEvent.SESSION_INVALIDATED, (payload) => {
			invalidatedSessionEventPayload = payload;
		});

		const userSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());

		await setTimeout(1100);
		const accessTokenPayload = await sessionManager.read(userSession.accessToken);

		await expect(sessionManager.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);

		await sessionManager.deleteOne(accessTokenPayload.sub, userSession.refreshToken, accessTokenPayload);
		expect(invalidatedSessionEventPayload).to.be.deep.eq(accessTokenPayload);

		await expect(sessionManager.read(userSession.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);

		await setTimeout(1000);
		await expect(sessionManager.read(userSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
	}).timeout(2500);

	it('invalidates all of the user sessions', async () => {
		const sessionManager = new JwtSessionManager(jwtSessionManagerOpts(2, 3, 'secret'));

		let invalidatedAllSessionsSubject: string | undefined;
		let invalidatedAllSessionsAccessTokenTtl: number | undefined;
		sessionManager.on(JwtManagerEvent.ALL_SESSIONS_INVALIDATED, (subject, accessTokenTtl) => {
			invalidatedAllSessionsSubject = subject;
			invalidatedAllSessionsAccessTokenTtl = accessTokenTtl;
		});

		const firstSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());
		await setTimeout(500);
		const secondSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());
		const adminSession = await sessionManager.create({ role: 'admin' }, { subject: 'uid2' }, sessionContext());

		// both sessions are still valid
		await expect(sessionManager.read(firstSession.accessToken)).to.eventually.have.property('role', 'user');
		await expect(sessionManager.read(secondSession.accessToken)).to.eventually.have.property('role', 'user');

		// read all of them, ensure they existing
		const activeSessions = Array.from((await sessionManager.readAll('uid1')).values());
		expect(activeSessions).to.be.ofSize(2);
		expect(activeSessions[0].ip).to.be.eq('127.0.0.1');
		expect(activeSessions[1].device!.type).to.be.eq('smartphone');

		// invalidate all of them
		const secondSessionPayload = await sessionManager.read(secondSession.accessToken);
		await expect(sessionManager.deleteAll(secondSessionPayload.sub, secondSessionPayload)).to.eventually.be.eq(2);
		expect(invalidatedAllSessionsSubject).to.be.deep.eq(secondSessionPayload.sub);
		expect(invalidatedAllSessionsAccessTokenTtl).to.be.deep.eq(secondSessionPayload.exp - secondSessionPayload.iat);

		await expect(sessionManager.read(firstSession.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);
		await expect(sessionManager.update(firstSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);

		await expect(sessionManager.read(secondSession.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);
		await expect(sessionManager.update(secondSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);

		// try to open another user session later
		await setTimeout(1000);
		const thirdSession = await sessionManager.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());
		await expect(sessionManager.read(thirdSession.accessToken)).to.eventually.have.property('sub', 'uid1');
		await expect(sessionManager.update(thirdSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.a('string');

		// admin session remains untouched
		await expect(sessionManager.read(adminSession.accessToken)).to.eventually.have.property('role', 'admin');

		await setTimeout(500);
		await expect(sessionManager.read(firstSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
		await setTimeout(500);
		await expect(sessionManager.read(secondSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
	}).timeout(3000);

	it('invalidates session in cluster mode', async () => {
		const node1Opts = jwtSessionManagerOpts(1, 2, 'secret');
		const node1 = new JwtSessionManager(node1Opts);

		const node2Opts = jwtSessionManagerOpts(1, 2, 'secret');
		// shared DB
		(node2Opts.invalidationOptions as MutableSome<InvalidationStrategyOptions<any, any>, 'refreshTokensStorage'>).refreshTokensStorage =
			node1Opts.invalidationOptions.refreshTokensStorage;
		const node2 = new JwtSessionManager(node2Opts);
		node2.on(JwtManagerEvent.SESSION_INVALIDATED, (accessTokenPayload) => {
			// simulate that accessTokenPayload was sent by event bus
			node1.restrictOne(accessTokenPayload);
		});

		const userSession = await node1.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());
		await expect(node1.read(userSession.accessToken)).to.eventually.have.property('role', 'user');
		await expect(node2.read(userSession.accessToken)).to.eventually.have.property('sub', 'uid1');

		const accessTokenPayload = await node1.read(userSession.accessToken);
		await node2.deleteOne(accessTokenPayload.sub, userSession.refreshToken, accessTokenPayload);

		await expect(node1.read(userSession.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);
		await expect(node2.read(userSession.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);

		await expect(node1.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);
		await expect(node2.update(userSession.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);

		await setTimeout(1100);
		await expect(node1.read(userSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
		await expect(node2.read(userSession.accessToken)).to.eventually.be.rejectedWith(TokenExpiredError);
	});

	it('invalidates all sessions in cluster mode', async () => {
		const node1Opts = jwtSessionManagerOpts(1, 2, 'secret');
		const node1 = new JwtSessionManager(node1Opts);

		const node2Opts = jwtSessionManagerOpts(1, 2, 'secret');
		// shared DB
		(node2Opts.invalidationOptions as MutableSome<InvalidationStrategyOptions<any, any>, 'refreshTokensStorage'>).refreshTokensStorage =
			node1Opts.invalidationOptions.refreshTokensStorage;
		const node2 = new JwtSessionManager(node2Opts);
		node2.on(JwtManagerEvent.ALL_SESSIONS_INVALIDATED, (subject, accessTokenTtl) => {
			// simulate that accessTokenPayload was sent by event bus
			node1.restrictAll(subject, accessTokenTtl);
		});

		// create sessions
		const node1Session = await node1.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());
		const node2Session = await node2.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());

		// invalidate them
		const node1SessionPayload = await node1.read(node1Session.accessToken);
		await expect(node2.deleteAll(node1SessionPayload.sub, node1SessionPayload)).to.eventually.be.eq(2);

		// access tokens are no longer valid
		await expect(node1.read(node2Session.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);
		await expect(node2.read(node1Session.accessToken)).to.eventually.be.rejectedWith(/Token '.+' was forcibly invalidated\./);

		// refresh tokens are no longer valid
		await expect(node1.update(node2Session.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);
		await expect(node2.update(node1Session.refreshToken, { role: 'user' }, { subject: 'uid1' }, sessionContext())).to.eventually.be.rejectedWith(
			/^Refresh token '.{20}' for subject uid1 doesn't exist\.$/
		);

		// creating new session should work
		await setTimeout(1000);
		const node1SecondSession = await node1.create({ role: 'user' }, { subject: 'uid1' }, sessionContext());
		await expect(node1.read(node1SecondSession.accessToken)).to.eventually.have.property('role', 'user');
		await expect(node2.read(node1SecondSession.accessToken)).to.eventually.have.property('role', 'user');
	});
});
