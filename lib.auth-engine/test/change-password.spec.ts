import { describe, it } from 'mocha';
import { expect } from 'chai';
import { hostname } from 'os';
import { chrono, string } from '@marin/lib.utils';
import Exception from '@marin/lib.error';
import basicAuthEngineConfig from './fixtures';
import { AuthenticationEngine, ErrorCodes } from '../lib';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { AuthRequest } from '../lib/types/requests';
import { checkIfJWTWasInvalidated } from './utils';

describe('Change password spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(basicAuthEngineConfig);

	const defaultRegistrationInfo = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		role: ACCOUNT_ROLES.MODERATOR // need long active sessions
	};

	const validAuthInput: AuthRequest = {
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

		await AuthEngineInstance.authenticate(validAuthInput);
		const activeSessions = await AuthEngineInstance.getActiveSessions(accountId);

		const newPassword = '42asdaffM!asd85';

		// authorization needs to be done at the upper layers
		expect(
			await AuthEngineInstance.changePassword({
				accountId,
				sessionId: activeSessions[0].timestamp,
				old: defaultRegistrationInfo.password,
				new: newPassword
			})
		).to.be.eq(0);

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthInput, password: newPassword });
		expect(authStatus.token).to.not.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.error).to.be.eq(undefined);
	});

	it('invalidates all sessions, excepting the one from where password was changed', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		const authStatus1 = await AuthEngineInstance.authenticate(validAuthInput);
		await chrono.sleep(1000);
		const authStatus2 = await AuthEngineInstance.authenticate(validAuthInput);
		await chrono.sleep(1000);
		const authStatus3 = await AuthEngineInstance.authenticate(validAuthInput);

		const activeSessionsBeforeChangePassword = await AuthEngineInstance.getActiveSessions(accountId);

		const newPassword = '42asdaffM!asd88';
		expect(
			await AuthEngineInstance.changePassword({
				accountId,
				sessionId: activeSessionsBeforeChangePassword[0].timestamp,
				old: defaultRegistrationInfo.password,
				new: newPassword
			})
		).to.be.eq(2); // 2 sessions were invalidated

		const activeSessionsAfterChangePassword = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessionsAfterChangePassword.length).to.be.eq(1);
		expect(activeSessionsAfterChangePassword[0].timestamp).to.be.eq(activeSessionsBeforeChangePassword[0].timestamp);

		expect(await basicAuthEngineConfig.jwt.instance.validate(authStatus1.token!)).to.not.be.eq(undefined);
		await checkIfJWTWasInvalidated(authStatus2.token!, basicAuthEngineConfig.jwt.instance);
		await checkIfJWTWasInvalidated(authStatus3.token!, basicAuthEngineConfig.jwt.instance);
	}).timeout(3000);

	it('does not invalidate other sessions if explicitly instructed not to do so', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		await AuthEngineInstance.authenticate(validAuthInput);
		await chrono.sleep(1000);
		await AuthEngineInstance.authenticate(validAuthInput);

		const activeSessionsBeforeChangePassword = await AuthEngineInstance.getActiveSessions(accountId);

		const newPassword = '42asdaffM!asd88';
		expect(
			await AuthEngineInstance.changePassword({
				accountId,
				sessionId: activeSessionsBeforeChangePassword[0].timestamp,
				old: defaultRegistrationInfo.password,
				new: newPassword,
				logAllOtherSessionsOut: false
			})
		).to.be.eq(undefined); // no sessions were invalidated

		const activeSessionsAfterChangePassword = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessionsAfterChangePassword.length).to.be.eq(activeSessionsBeforeChangePassword.length);
	});

	it('fails to change password if provided account id is not valid', async () => {
		let accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		accountId = string.replaceAt('0', accountId.length - 1, accountId);
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, old: 'does not matter', new: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} not found.`);
	});

	it('fails to change password if account is locked', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		await AuthEngineInstance.lockAccount(accountId, 'Suspicious activity detected');
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, old: 'invalid', new: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_LOCKED);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} is locked.`);
	});

	it('fails to change password if the old one provided is not valid', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, old: 'invalid', new: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_PASSWORD);
		expect(err).to.haveOwnProperty('message', "Old passwords doesn't match.");
	});

	it('fails to change password if the new one is weak', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, old: defaultRegistrationInfo.password, new: 'Weak-password' });
		} catch (e) {
			err = e;
		}
		expect(err)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.WEAK_PASSWORD);
		expect(err).to.haveOwnProperty('message', 'The password must contain at least one number.');
	});
});
