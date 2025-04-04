import { faker } from '@faker-js/faker';
import { Exception } from '@thermopylae/lib.exception';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { ActivateAccountSessionRedisRepository, ErrorCodes } from '../../lib/index.js';
import { generateAccount } from '../fixtures/generator.js';
import { FAST_SYMMETRIC_ENCRYPTION } from '../fixtures/store.js';

describe(`${ActivateAccountSessionRedisRepository.name} spec`, function suite() {
	const activateAccountSessionRedisRepository = new ActivateAccountSessionRedisRepository('activ-acc', FAST_SYMMETRIC_ENCRYPTION);

	it('reads inserted account', async () => {
		const token = faker.string.hexadecimal({ length: 15 });
		const account = generateAccount({ nullify: ['passwordSalt', 'telephone', 'totpSecret', 'pubKey'], delete: ['id'] });
		await activateAccountSessionRedisRepository.insert(token, account, 5);

		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.deep.eq(account);
	});

	it('does not overwrite inserted account', async () => {
		/* INSERT */
		const token = faker.string.hexadecimal({ length: 15 });
		const account = generateAccount({ nullify: ['passwordSalt', 'telephone', 'totpSecret', 'pubKey'], delete: ['id'] });
		await activateAccountSessionRedisRepository.insert(token, account, 5);

		/* TRY UPDATE */
		let err: Error | null = null;
		try {
			await activateAccountSessionRedisRepository.insert(token, account, 5);
		} catch (error) {
			err = error;
		}
		expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACTIVATE_ACCOUNT_SESSION_NOT_CREATED);
		expect(err).to.haveOwnProperty(
			'message',
			`Failed to insert activate account session for account with username '${account.username}' and email '${account.email}'.`
		);

		/* READ */
		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.deep.eq(account);
	});

	it('returns null when account does not exist', async () => {
		/* READ NON EXISTING */
		await expect(activateAccountSessionRedisRepository.read(faker.string.hexadecimal({ length: 15 }))).resolves.to.be.eq(null);

		/* READ EXPIRED */
		const token = faker.string.hexadecimal({ length: 15 });
		const account = generateAccount({ nullify: ['passwordSalt', 'telephone', 'totpSecret', 'pubKey'], delete: ['id'] });
		await activateAccountSessionRedisRepository.insert(token, account, 1);

		await sleep(1100);
		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.eq(null);
	});

	it('deletes account', async () => {
		/* INSERT */
		const token = faker.string.hexadecimal({ length: 15 });
		const account = generateAccount({ nullify: ['passwordSalt', 'telephone', 'totpSecret', 'pubKey'], delete: ['id'] });
		await activateAccountSessionRedisRepository.insert(token, account, 5);

		/* ENSURE EXISTS */
		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.deep.eq(account);

		/* DELETE */
		await activateAccountSessionRedisRepository.delete(token);
		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.eq(null);

		await activateAccountSessionRedisRepository.delete(token); // delete non existing
		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.eq(null);
	});
});
