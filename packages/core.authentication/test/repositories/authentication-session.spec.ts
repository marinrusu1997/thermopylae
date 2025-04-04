import { faker } from '@faker-js/faker';
import type { AuthenticationSession } from '@thermopylae/lib.authentication';
import { chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { AuthenticationSessionRedisRepository } from '../../lib/index.js';

describe(`${AuthenticationSessionRedisRepository.name} spec`, function suite() {
	const authenticationSessionRedisRepository = new AuthenticationSessionRedisRepository('auth-sess');

	it('reads inserted session', async () => {
		const username = faker.internet.username();
		const deviceId = faker.string.hexadecimal({ length: 20 });
		const session: AuthenticationSession = {
			twoFactorAuthenticationToken: faker.string.alphanumeric({ length: 10 }),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 5);

		await expect(authenticationSessionRedisRepository.read(username, deviceId)).resolves.to.be.deep.eq(session);
	});

	it('reads updated session', { timeout: 2_500 }, async () => {
		/* INSERT */
		const username = faker.internet.username();
		const deviceId = faker.string.hexadecimal({ length: 20 });
		const session: AuthenticationSession = {
			twoFactorAuthenticationToken: faker.string.alphanumeric({ length: 10 }),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 2);

		/* UPDATE */
		session.challengeResponseNonce = 'nonce';
		await chrono.sleep(1000);
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 2);

		/* READ */
		await chrono.sleep(1100);
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).resolves.to.be.deep.eq(session);
	});

	it('returns null when session does not exist', async () => {
		const username = faker.internet.username();
		const deviceId = faker.string.hexadecimal({ length: 20 });

		/* READ NON EXISTING */
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).resolves.to.be.eq(null);

		/* READ EXPIRED */
		const session: AuthenticationSession = {
			twoFactorAuthenticationToken: faker.string.alphanumeric({ length: 10 }),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 1);

		await chrono.sleep(1100);
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).resolves.to.be.eq(null);
	});

	it('deletes session', async () => {
		/* INSERT */
		const username = faker.internet.username();
		const deviceId = faker.string.hexadecimal({ length: 20 });
		const session: AuthenticationSession = {
			twoFactorAuthenticationToken: faker.string.alphanumeric({ length: 10 }),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 5);

		/* ENSURE EXISTS */
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).resolves.to.be.deep.eq(session);

		/* DELETE */
		await authenticationSessionRedisRepository.delete(username, deviceId);
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).resolves.to.be.eq(null);

		await authenticationSessionRedisRepository.delete(username, deviceId); // delete non existing
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).resolves.to.be.eq(null);
	});
});
