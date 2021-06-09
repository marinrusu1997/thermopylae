import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { AccountWithTotpSecret, AuthenticationEngine, ErrorCodes } from '../lib';
import { buildAccountToBeRegistered, GlobalAuthenticationContext, validateSuccessfulLogin } from './utils';
import { EmailSenderInstance } from './fixtures/senders/email';
import { OnPasswordChangedHookMock } from './fixtures/hooks';

describe('Change password spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it.only('changes password and then logs in with updated one', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		const oldPassword = account.passwordHash;
		await AuthEngineInstance.register(account);

		/* CHANGE PASSWORD */
		const newPassword = '42asdaffM!asd85';
		await AuthEngineInstance.changePassword({
			accountId: account.id,
			oldPassword,
			newPassword,
			ip: '127.0.0.1'
		});

		expect(EmailSenderInstance.client.outboxFor(account.email, 'notifyPasswordChanged')).to.be.ofSize(1);
		expect(OnPasswordChangedHookMock.calls).to.be.equalTo([account.id]);

		/* AUTHENTICATE WITH OLD PASSWORD (FAILURE) */
		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus!.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);

		/* AUTHENTICATE WITH NEW PASSWORD */
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});

	/*
	it('changes password after new hashing algorithm is used', async () => {
		const [authEngineHashAlg1, authEngineHashAlg2] = createAuthEnginesWithDifferentPasswordHashingAlg(AuthenticationEngineDefaultOptions);

		// Register and Authenticate with AUTH ENGINE which uses HASHING ALG 1
		const accountId = await authEngineHashAlg1.register(defaultRegistrationInfo, { enabled: true });
		await validateSuccessfulLogin(authEngineHashAlg1, validAuthRequest);
		const activeSessions = await authEngineHashAlg1.getActiveSessions(accountId);

		// Change password with AUTH ENGINE which uses HASHING ALG 2
		const newPassword = string.generateStringOfLength(30);
		await authEngineHashAlg2.changePassword({
			accountId,
			sessionId: activeSessions[0].authenticatedAtUNIX,
			oldPassword: defaultRegistrationInfo.password,
			newPassword
		});

		// Login with AUTH ENGINE which uses HASHING ALG 1
		await validateSuccessfulLogin(authEngineHashAlg1, { ...validAuthRequest, password: newPassword });

		// Login with AUTH ENGINE which uses HASHING ALG 2
		await validateSuccessfulLogin(authEngineHashAlg2, { ...validAuthRequest, password: newPassword });
	});

	it('invalidates all sessions, excepting the one from where password was changed', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		const authStatus1 = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(authStatus1.error).to.be.eq(undefined);

		await chrono.sleep(1000);
		const authStatus2 = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(authStatus2.error).to.be.eq(undefined);

		await chrono.sleep(1000);
		const authStatus3 = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(authStatus3.error).to.be.eq(undefined);

		const activeSessionsBeforeChangePassword = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessionsBeforeChangePassword.length).to.be.eq(3);

		const newPassword = '42asdaffM!asd88';
		expect(
			await AuthEngineInstance.changePassword({
				accountId,
				sessionId: activeSessionsBeforeChangePassword[0].authenticatedAtUNIX,
				oldPassword: defaultRegistrationInfo.password,
				newPassword
			})
		).to.be.eq(2); // 2 sessions were invalidated

		const activeSessionsAfterChangePassword = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessionsAfterChangePassword.length).to.be.eq(1);
		expect(activeSessionsAfterChangePassword[0].authenticatedAtUNIX).to.be.eq(activeSessionsBeforeChangePassword[0].authenticatedAtUNIX);

		expect(await AuthenticationEngineDefaultOptions.jwt.instance.validate(authStatus1.token!)).to.not.be.eq(undefined);
		await checkIfJWTWasInvalidated(authStatus2.token!, AuthenticationEngineDefaultOptions.jwt.instance);
		await checkIfJWTWasInvalidated(authStatus3.token!, AuthenticationEngineDefaultOptions.jwt.instance);
	}).timeout(3000);

	it('does not invalidate other sessions if explicitly instructed not to do so', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		await AuthEngineInstance.authenticate(validAuthRequest);
		await chrono.sleep(1000);
		await AuthEngineInstance.authenticate(validAuthRequest);

		const activeSessionsBeforeChangePassword = await AuthEngineInstance.getActiveSessions(accountId);

		const newPassword = '42asdaffM!asd88';
		expect(
			await AuthEngineInstance.changePassword({
				accountId,
				sessionId: activeSessionsBeforeChangePassword[0].authenticatedAtUNIX,
				oldPassword: defaultRegistrationInfo.password,
				newPassword,
				logAllOtherSessionsOut: false
			})
		).to.be.eq(0); // no sessions were invalidated

		const activeSessionsAfterChangePassword = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessionsAfterChangePassword.length).to.be.eq(activeSessionsBeforeChangePassword.length);
	});

	it('fails to change password if provided account id is not valid', async () => {
		let accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		accountId = string.replaceAt('0', accountId.length - 1, accountId);
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, oldPassword: 'does not matter', newPassword: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} not found. `);
	});

	it('fails to change password if account is disabled', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		await AuthEngineInstance.disableAccount(accountId, 'Suspicious activity detected');
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, oldPassword: 'invalid', newPassword: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
	});

	it('fails to change password if the old one provided is not valid', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, oldPassword: 'invalid', newPassword: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_PASSWORD);
		expect(err).to.haveOwnProperty('message', "Old passwords doesn't match. ");
	});

	it('fails to change password if the new one is the same as the old one', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({
				accountId,
				sessionId: 0,
				oldPassword: defaultRegistrationInfo.password,
				newPassword: defaultRegistrationInfo.password
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SIMILAR_PASSWORDS);
		expect(err).to.haveOwnProperty('message', 'New password is same as the old one. ');
	});

	it('when provided old and new passwords are the same, will trigger an error only after ensuring that they are also equal to the stored one', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, oldPassword: 'same', newPassword: 'same' });
		} catch (e) {
			err = e;
		}
		// will try to validate firstly against stored one, thus preventing false positives in the following scenario:
		// old = 'same', new = 'same', stored = 'valid'
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_PASSWORD);
		expect(err).to.haveOwnProperty('message', "Old passwords doesn't match. ");
	});

	it('fails to change password if the new one is weak', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		let err;
		try {
			await AuthEngineInstance.changePassword({ accountId, sessionId: 0, oldPassword: defaultRegistrationInfo.password, newPassword: 'Weak-password' });
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.WEAK_PASSWORD);
		expect(err).to.haveOwnProperty('message', 'The password must contain at least one number.');
	});
	 */
});
