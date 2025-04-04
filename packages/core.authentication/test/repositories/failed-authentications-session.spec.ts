import { faker } from '@faker-js/faker';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { FailedAuthenticationAttemptsSessionRedisRepository } from '../../lib/index.js';
import { generateFailedAuthenticationAttemptSession, generateLocation } from '../fixtures/generator.js';

describe(`${FailedAuthenticationAttemptsSessionRedisRepository.name} spec`, function suite() {
	const failedAuthenticationAttemptsSessionRedisRepository = new FailedAuthenticationAttemptsSessionRedisRepository('fail-auth-sess');

	it('reads inserted session', async () => {
		const username = faker.internet.username();
		const session = generateFailedAuthenticationAttemptSession();
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 5);

		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).resolves.to.be.deep.eq(session);
	});

	it('reads updated session', { timeout: 2500 }, async () => {
		/* INSERT */
		const username = faker.internet.username();
		const session = generateFailedAuthenticationAttemptSession({
			include: { counter: 2 }
		});
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 2);

		/* UPDATE */
		session.location = generateLocation();
		await sleep(1000);
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 2);

		/* READ */
		await sleep(1100);
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).resolves.to.be.deep.eq(session);
	});

	it('returns null when session does not exist', async () => {
		const username = faker.internet.username();

		/* READ NON EXISTING */
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).resolves.to.be.eq(null);

		/* READ EXPIRED */
		const session = generateFailedAuthenticationAttemptSession({
			include: { counter: 2 }
		});
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 1);

		await sleep(1100);
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).resolves.to.be.eq(null);
	});

	it('deletes session', async () => {
		/* INSERT */
		const username = faker.internet.username();
		const session = generateFailedAuthenticationAttemptSession({
			include: { counter: 2 }
		});
		await failedAuthenticationAttemptsSessionRedisRepository.upsert(username, session, 5);

		/* ENSURE EXISTS */
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).resolves.to.be.deep.eq(session);

		/* DELETE */
		await failedAuthenticationAttemptsSessionRedisRepository.delete(username);
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).resolves.to.be.eq(null);

		await failedAuthenticationAttemptsSessionRedisRepository.delete(username); // delete non existing
		await expect(failedAuthenticationAttemptsSessionRedisRepository.read(username)).resolves.to.be.eq(null);
	});
});
