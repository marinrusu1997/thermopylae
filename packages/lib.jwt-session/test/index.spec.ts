import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { chrono } from '@thermopylae/lib.utils';
import { JwtSessionManager } from '../lib';
import { InvalidAccessTokensCacheAdapter } from './mocks/invalid-access-tokens-cache';
import { RefreshTokensStorageAdapter } from './mocks/refresh-tokens-storage';

describe(`${JwtSessionManager.name} spec`, () => {
	it('creates sessions and renews them', async () => {
		const sessionManager = new JwtSessionManager({
			secret: 'secret-kept-somewhere',
			signOptions: {
				algorithm: 'HS384',
				issuer: 'auth-server.com',
				audience: ['auth-server.com', 'rest-server.com'],
				expiresIn: 2
			},
			verifyOptions: {
				algorithms: ['HS384'],
				issuer: 'auth-server.com',
				audience: 'rest-server.com'
			},
			invalidationStrategyOptions: {
				refreshTokenLength: 20,
				refreshTokenTtl: 3,
				invalidAccessTokensCache: new InvalidAccessTokensCacheAdapter(),
				refreshTokensStorage: new RefreshTokensStorageAdapter()
			}
		});

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

		await expect(sessionManager.read(sessionTokens.accessToken)).to.eventually.throw('aaa');

		const refreshedAccessTokenPayload = await sessionManager.read(refreshedAccessToken);
		expect(refreshedAccessTokenPayload.anc).to.be.eq(sessionTokens.refreshToken.slice(0, 5));
		expect(refreshedAccessTokenPayload.role).to.be.eq('admin');
		expect(refreshedAccessTokenPayload.sub).to.be.eq('uid1');

		// expires soon
		await expect(sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' })).to.eventually.throw('aaa');

		/* After 3 sec 100 ms */
		await chrono.sleep(1000);

		await expect(sessionManager.read(refreshedAccessToken)).to.eventually.throw('aaa');
		// expired
		await expect(sessionManager.update(sessionTokens.refreshToken, { role: 'admin' }, { subject: 'uid1' })).to.eventually.throw('aaa');
	}).timeout(3500);
});
