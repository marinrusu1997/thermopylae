import { faker } from '@faker-js/faker';
import { AccountStatus, type AccountWithTotpSecret } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { array, chrono } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { ActivateAccountSessionRedisRepository, ErrorCodes } from '../../lib/index.js';

describe(`${ActivateAccountSessionRedisRepository.name} spec`, function suite() {
	const activateAccountSessionRedisRepository = new ActivateAccountSessionRedisRepository('activ-acc');

	it('reads inserted account', async () => {
		const token = faker.string.hexadecimal({ length: 15 });
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.username(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.number.int({ min: 0, max: 9 }),
			email: faker.internet.email(),
			telephone: null,
			disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
			mfa: faker.datatype.boolean(),
			totpSecret: null!,
			pubKey: null
		};
		await activateAccountSessionRedisRepository.insert(token, account, 5);

		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.deep.eq(account);
	});

	it('does not overwrite inserted account', async () => {
		/* INSERT */
		const token = faker.string.hexadecimal({ length: 15 });
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.username(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.number.int({ min: 0, max: 9 }),
			email: faker.internet.email(),
			telephone: null,
			disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
			mfa: faker.datatype.boolean(),
			totpSecret: null!,
			pubKey: null
		};
		await activateAccountSessionRedisRepository.insert(token, account, 5);

		/* TRY UPDATE */
		let err;
		try {
			await activateAccountSessionRedisRepository.insert(token, account, 5);
		} catch (e) {
			err = e;
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
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.username(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.number.int({ min: 0, max: 9 }),
			email: faker.internet.email(),
			telephone: null,
			disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
			mfa: faker.datatype.boolean(),
			totpSecret: null!,
			pubKey: null
		};
		await activateAccountSessionRedisRepository.insert(token, account, 1);

		await chrono.sleep(1100);
		await expect(activateAccountSessionRedisRepository.read(token)).resolves.to.be.eq(null);
	});

	it('deletes account', async () => {
		/* INSERT */
		const token = faker.string.hexadecimal({ length: 15 });
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.username(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.number.int({ min: 0, max: 9 }),
			email: faker.internet.email(),
			telephone: null,
			disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
			mfa: faker.datatype.boolean(),
			totpSecret: null!,
			pubKey: null
		};
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
