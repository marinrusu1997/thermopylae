import { describe, it } from 'mocha';
import { expect } from 'chai';
import { hostname } from 'os';
import { string } from '@marin/lib.utils';
import Exception from '@marin/lib.error';
import basicAuthEngineConfig from './fixtures';
import { AuthenticationEngine } from '../lib/core';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { AuthInput } from '../lib/types';
import { ErrorCodes } from '../lib/error';

describe('Change password spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(basicAuthEngineConfig);

	const defaultRegistrationInfo = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		role: ACCOUNT_ROLES.USER
	};

	const validNetworkInput: AuthInput = {
		username: defaultRegistrationInfo.username,
		password: defaultRegistrationInfo.password,
		ip: '158.56.89.230',
		device: hostname(),
		location: {
			countryCode: 'US',
			regionCode: 'CA',
			city: 'Los Angeles',
			postalCode: '90067',
			timeZone: 'America/Los_Angeles',
			latitude: 34.0577507019043,
			longitude: -118.41380310058594
		}
	};

	it('changes password and then logs in with updated one', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		// authentication needs to be done at upper layers, let's pretend that we are already authenticated
		const newPassword = '42asdaffM!asd85';
		await AuthEngineInstance.changePassword({ accountId, oldPassword: defaultRegistrationInfo.password, newPassword });
		const authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, password: newPassword });
		expect(authStatus.token).to.not.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.error).to.be.eq(undefined);
	});

	it('fails to change password if provided account id is not valid', async () => {
		let accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		accountId = string.replaceAt('0', accountId.length - 1, accountId);
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, oldPassword: 'does not matter', newPassword: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} not found.`);
	});

	it('fails to change password if account is locked', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		await AuthEngineInstance.lockAccount(accountId, 'Suspicious activity detected');
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, oldPassword: 'invalid', newPassword: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_IS_LOCKED);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} is locked.`);
	});

	it('fails to change password if the old one provided is not valid', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, oldPassword: 'invalid', newPassword: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.INVALID_PASSWORD);
		expect(err).to.haveOwnProperty('message', "Old passwords doesn't match.");
	});

	it('fails to change password if the new one is weak', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, oldPassword: defaultRegistrationInfo.password, newPassword: 'Weak-password' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.WEAK_PASSWORD);
		expect(err).to.haveOwnProperty('message', 'The password must contain at least one number.');
	});
});
