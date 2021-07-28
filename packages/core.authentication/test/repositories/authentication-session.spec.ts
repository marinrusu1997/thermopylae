import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import faker from 'faker';
import { AuthenticationSession } from '@thermopylae/lib.authentication';
import { chrono } from '@thermopylae/lib.utils';
import { AuthenticationSessionRedisRepository } from '../../lib';

describe(`${AuthenticationSessionRedisRepository.name} spec`, function suite() {
	const authenticationSessionRedisRepository = new AuthenticationSessionRedisRepository('auth-sess');

	it('reads inserted session', async () => {
		const username = faker.internet.userName();
		const deviceId = faker.datatype.string();
		const session: AuthenticationSession = {
			'2fa-token': faker.datatype.string(8),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 5);

		await expect(authenticationSessionRedisRepository.read(username, deviceId)).to.eventually.be.deep.eq(session);
	});

	it('reads updated session', async () => {
		/* INSERT */
		const username = faker.internet.userName();
		const deviceId = faker.datatype.string();
		const session: AuthenticationSession = {
			'2fa-token': faker.datatype.string(8),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 2);

		/* UPDATE */
		session.challengeResponseNonce = 'nonce';
		await chrono.sleep(1000);
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 2);

		/* READ */
		await chrono.sleep(1100);
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).to.eventually.be.deep.eq(session);
	}).timeout(2_500);

	it('returns null when session does not exist', async () => {
		const username = faker.internet.userName();
		const deviceId = faker.datatype.string();

		/* READ NON EXISTING */
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).to.eventually.be.eq(null);

		/* READ EXPIRED */
		const session: AuthenticationSession = {
			'2fa-token': faker.datatype.string(8),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 1);

		await chrono.sleep(1100);
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).to.eventually.be.eq(null);
	});

	it('deletes session', async () => {
		/* INSERT */
		const username = faker.internet.userName();
		const deviceId = faker.datatype.string();
		const session: AuthenticationSession = {
			'2fa-token': faker.datatype.string(8),
			recaptchaRequired: true
		};
		await authenticationSessionRedisRepository.upsert(username, deviceId, session, 5);

		/* ENSURE EXISTS */
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).to.eventually.be.deep.eq(session);

		/* DELETE */
		await authenticationSessionRedisRepository.delete(username, deviceId);
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).to.eventually.be.eq(null);

		await authenticationSessionRedisRepository.delete(username, deviceId); // delete non existing
		await expect(authenticationSessionRedisRepository.read(username, deviceId)).to.eventually.be.eq(null);
	});
});
