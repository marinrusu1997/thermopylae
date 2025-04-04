import { faker } from '@faker-js/faker';
import { Exception } from '@thermopylae/lib.exception';
import { chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { ErrorCodes, ForgotPasswordSessionRedisRepository } from '../../lib/index.js';

describe(`${ForgotPasswordSessionRedisRepository.name} spec`, function suite() {
	const forgotPasswordSessionRedisRepository = new ForgotPasswordSessionRedisRepository('fgt-pwd');

	it('reads inserted token', async () => {
		const token = faker.string.hexadecimal({ length: 15 });
		await forgotPasswordSessionRedisRepository.insert(token, 5);

		await expect(forgotPasswordSessionRedisRepository.exists(token)).resolves.to.be.eq(true);
	});

	it('does not overwrite inserted token', async () => {
		/* INSERT */
		const token = faker.string.hexadecimal({ length: 15 });
		await forgotPasswordSessionRedisRepository.insert(token, 5);

		/* TRY UPDATE */
		let err;
		try {
			await forgotPasswordSessionRedisRepository.insert(token, 5);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.FORGOT_PASSWORD_SESSION_NOT_CREATED);
		expect(err).to.haveOwnProperty('message', 'Failed to insert forgot password session.');

		/* READ */
		await expect(forgotPasswordSessionRedisRepository.exists(token)).resolves.to.be.eq(true);
	});

	it("returns 'false' when token does not exist", async () => {
		/* READ NON EXISTING */
		await expect(forgotPasswordSessionRedisRepository.exists(faker.string.hexadecimal({ length: 15 }))).resolves.to.be.eq(false);

		/* READ EXPIRED */
		const token = faker.string.hexadecimal({ length: 15 });
		await forgotPasswordSessionRedisRepository.insert(token, 1);

		await chrono.sleep(1100);
		await expect(forgotPasswordSessionRedisRepository.exists(token)).resolves.to.be.eq(false);
	});

	it('deletes token', async () => {
		/* INSERT */
		const token = faker.string.hexadecimal({ length: 15 });
		await forgotPasswordSessionRedisRepository.insert(token, 5);

		/* ENSURE EXISTS */
		await expect(forgotPasswordSessionRedisRepository.exists(token)).resolves.to.be.eq(true);

		/* DELETE */
		await forgotPasswordSessionRedisRepository.delete(token);
		await expect(forgotPasswordSessionRedisRepository.exists(token)).resolves.to.be.eq(false);

		await forgotPasswordSessionRedisRepository.delete(token); // delete non existing
		await expect(forgotPasswordSessionRedisRepository.exists(token)).resolves.to.be.eq(false);
	});
});
