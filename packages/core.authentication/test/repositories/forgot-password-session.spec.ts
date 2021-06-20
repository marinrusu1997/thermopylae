import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import faker from 'faker';
import { chrono } from '@thermopylae/lib.utils';
import { Exception } from '@thermopylae/lib.exception';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { ForgotPasswordSessionRedisRepository } from '../../lib';

describe(`${ForgotPasswordSessionRedisRepository.name} spec`, function suite() {
	const forgotPasswordSessionRedisRepository = new ForgotPasswordSessionRedisRepository('fgt-pwd');

	it('reads inserted token', async () => {
		const token = faker.datatype.string();
		await forgotPasswordSessionRedisRepository.insert(token, 5);

		await expect(forgotPasswordSessionRedisRepository.exists(token)).to.eventually.be.eq(true);
	});

	it('does not overwrite inserted token', async () => {
		/* INSERT */
		const token = faker.datatype.string();
		await forgotPasswordSessionRedisRepository.insert(token, 5);

		/* TRY UPDATE */
		let err;
		try {
			await forgotPasswordSessionRedisRepository.insert(token, 5);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceof(Exception).and.to.haveOwnProperty('code', ErrorCodes.NOT_CREATED);
		expect(err).to.haveOwnProperty('message', 'Failed to insert forgot password session.');

		/* READ */
		await expect(forgotPasswordSessionRedisRepository.exists(token)).to.eventually.be.eq(true);
	});

	it("returns 'false' when token does not exist", async () => {
		/* READ NON EXISTING */
		await expect(forgotPasswordSessionRedisRepository.exists(faker.datatype.string())).to.eventually.be.eq(false);

		/* READ EXPIRED */
		const token = faker.datatype.string();
		await forgotPasswordSessionRedisRepository.insert(token, 1);

		await chrono.sleep(1100);
		await expect(forgotPasswordSessionRedisRepository.exists(token)).to.eventually.be.eq(false);
	});

	it('deletes token', async () => {
		/* INSERT */
		const token = faker.datatype.string();
		await forgotPasswordSessionRedisRepository.insert(token, 5);

		/* ENSURE EXISTS */
		await expect(forgotPasswordSessionRedisRepository.exists(token)).to.eventually.be.eq(true);

		/* DELETE */
		await forgotPasswordSessionRedisRepository.delete(token);
		await expect(forgotPasswordSessionRedisRepository.exists(token)).to.eventually.be.eq(false);

		await forgotPasswordSessionRedisRepository.delete(token); // delete non existing
		await expect(forgotPasswordSessionRedisRepository.exists(token)).to.eventually.be.eq(false);
	});
});
