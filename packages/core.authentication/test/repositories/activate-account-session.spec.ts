// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import faker from 'faker';
import { array, chrono } from '@thermopylae/lib.utils';
import { AccountStatus, AccountWithTotpSecret } from '@thermopylae/lib.authentication';
import { Exception } from '@thermopylae/lib.exception';
import { ActivateAccountSessionRedisRepository, ErrorCodes } from '../../lib';

describe(`${ActivateAccountSessionRedisRepository.name} spec`, function suite() {
	const activateAccountSessionRedisRepository = new ActivateAccountSessionRedisRepository('activ-acc');

	it('reads inserted account', async () => {
		const token = faker.datatype.string();
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.userName(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.datatype.number(9),
			email: faker.internet.email(),
			telephone: null,
			disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
			mfa: faker.datatype.boolean(),
			totpSecret: null!,
			pubKey: null
		};
		await activateAccountSessionRedisRepository.insert(token, account, 5);

		await expect(activateAccountSessionRedisRepository.read(token)).to.eventually.be.deep.eq(account);
	});

	it('does not overwrite inserted account', async () => {
		/* INSERT */
		const token = faker.datatype.string();
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.userName(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.datatype.number(9),
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
		await expect(activateAccountSessionRedisRepository.read(token)).to.eventually.be.deep.eq(account);
	});

	it('returns null when account does not exist', async () => {
		/* READ NON EXISTING */
		await expect(activateAccountSessionRedisRepository.read(faker.datatype.string())).to.eventually.be.eq(null);

		/* READ EXPIRED */
		const token = faker.datatype.string();
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.userName(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.datatype.number(9),
			email: faker.internet.email(),
			telephone: null,
			disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
			mfa: faker.datatype.boolean(),
			totpSecret: null!,
			pubKey: null
		};
		await activateAccountSessionRedisRepository.insert(token, account, 1);

		await chrono.sleep(1100);
		await expect(activateAccountSessionRedisRepository.read(token)).to.eventually.be.eq(null);
	});

	it('deletes account', async () => {
		/* INSERT */
		const token = faker.datatype.string();
		const account: AccountWithTotpSecret = {
			id: null!,
			username: faker.internet.userName(),
			passwordHash: faker.internet.password(),
			passwordSalt: null,
			passwordAlg: faker.datatype.number(9),
			email: faker.internet.email(),
			telephone: null,
			disabledUntil: array.randomElement([AccountStatus.DISABLED_UNTIL_ACTIVATION, AccountStatus.ENABLED, chrono.unixTime()]),
			mfa: faker.datatype.boolean(),
			totpSecret: null!,
			pubKey: null
		};
		await activateAccountSessionRedisRepository.insert(token, account, 5);

		/* ENSURE EXISTS */
		await expect(activateAccountSessionRedisRepository.read(token)).to.eventually.be.deep.eq(account);

		/* DELETE */
		await activateAccountSessionRedisRepository.delete(token);
		await expect(activateAccountSessionRedisRepository.read(token)).to.eventually.be.eq(null);

		await activateAccountSessionRedisRepository.delete(token); // delete non existing
		await expect(activateAccountSessionRedisRepository.read(token)).to.eventually.be.eq(null);
	});
});
