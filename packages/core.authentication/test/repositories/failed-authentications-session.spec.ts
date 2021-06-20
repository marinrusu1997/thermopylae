import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import faker from 'faker';
import { chrono } from '@thermopylae/lib.utils';
import { FailedAuthenticationAttemptSession } from '@thermopylae/lib.authentication';
import { FailedAuthenticationAttemptsSessionRedisRepository } from '../../lib';

describe(`${FailedAuthenticationAttemptsSessionRedisRepository.name} spec`, function suite() {
	const failedAuthenticationAttemptsSessionRedisRepository = new FailedAuthenticationAttemptsSessionRedisRepository('fail-auth-sess');

	it('reads inserted session', async () => {
		const username = faker.internet.userName();
		const session: FailedAuthenticationAttemptSession = {
			detectedAt: chrono.unixTime(),
			ip: faker.internet.ip(),
			counter: 1
		};
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 5);

		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).to.eventually.be.deep.eq(session);
	});

	it('reads updated session', async () => {
		/* INSERT */
		const username = faker.internet.userName();
		const session: FailedAuthenticationAttemptSession = {
			detectedAt: chrono.unixTime(),
			ip: faker.internet.ip(),
			counter: 2
		};
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 2);

		/* UPDATE */
		session.location = {
			countryCode: 'MD',
			regionCode: 'FL',
			city: 'Pietrosu',
			longitude: null,
			latitude: null,
			timezone: null
		};
		await chrono.sleep(1000);
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 2);

		/* READ */
		await chrono.sleep(1100);
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).to.eventually.be.deep.eq(session);
	}).timeout(2_500);

	it('returns null when session does not exist', async () => {
		const username = faker.internet.userName();

		/* READ NON EXISTING */
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).to.eventually.be.eq(null);

		/* READ EXPIRED */
		const session: FailedAuthenticationAttemptSession = {
			detectedAt: chrono.unixTime(),
			ip: faker.internet.ip(),
			counter: 2
		};
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 1);

		await chrono.sleep(1100);
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).to.eventually.be.eq(null);
	});

	it('deletes session', async () => {
		/* INSERT */
		const username = faker.internet.userName();
		const session: FailedAuthenticationAttemptSession = {
			detectedAt: chrono.unixTime(),
			ip: faker.internet.ip(),
			counter: 2
		};
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 5);

		/* ENSURE EXISTS */
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).to.eventually.be.deep.eq(session);

		/* DELETE */
		await failedAuthenticationAttemptsSessionRedisRepository.delete(username);
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).to.eventually.be.eq(null);

		await failedAuthenticationAttemptsSessionRedisRepository.delete(username); // delete non existing
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).to.eventually.be.eq(null);
	});
});
