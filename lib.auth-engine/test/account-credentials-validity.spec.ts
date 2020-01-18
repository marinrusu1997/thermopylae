import { describe, it } from 'mocha';
import { expect } from 'chai';
import Exception from '@marin/lib.error';
import { string } from '@marin/lib.utils';
import basicAuthEngineConfig from './fixtures';
import { AuthenticationEngine, ErrorCodes } from '../lib';
import { ACCOUNT_ROLES } from './fixtures/jwt';

describe('Validate account credentials spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(basicAuthEngineConfig);

	const defaultRegistrationInfo = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		role: ACCOUNT_ROLES.USER
	};

	it('fails to validate account credentials when account does not exist', async () => {
		let accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		accountId = string.replaceAt('0', accountId.length - 1, accountId);
		let err;
		try {
			await AuthEngineInstance.areAccountCredentialsValid(accountId, { username: 'does not matter', password: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} not found.`);
	});

	it('validates correct account credentials', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		const areValid = await AuthEngineInstance.areAccountCredentialsValid(accountId, {
			username: defaultRegistrationInfo.username,
			password: defaultRegistrationInfo.password
		});
		expect(areValid).to.be.eq(true);
	});

	it('validates correctly credentials when username is not valid', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		const areValid = await AuthEngineInstance.areAccountCredentialsValid(accountId, {
			username: 'invalid',
			password: defaultRegistrationInfo.password
		});
		expect(areValid).to.be.eq(false);
	});

	it('validates correctly credentials when password is not valid', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		const areValid = await AuthEngineInstance.areAccountCredentialsValid(accountId, {
			username: defaultRegistrationInfo.username,
			password: 'invalid'
		});
		expect(areValid).to.be.eq(false);
	});
});
