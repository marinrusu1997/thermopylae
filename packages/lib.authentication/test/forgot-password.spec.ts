import { Exception } from '@thermopylae/lib.exception';
import { chrono, string } from '@thermopylae/lib.utils';
import { describe, expect, it } from 'vitest';
import { type AccountWithTotpSecret, AuthenticationEngine, ErrorCodes } from '../lib/index.js';
import { AuthenticationStepName } from '../lib/types/enums.js';
import { OnForgottenPasswordChangedHookMock } from './fixtures/hooks.js';
import { AuthenticationEngineDefaultOptions, ForgotPasswordTokenEncryption, PasswordLengthValidatorOptions } from './fixtures/index.js';
import { MemoryCache } from './fixtures/memory-cache.js';
import { EmailSenderInstance } from './fixtures/senders/email.js';
import { SmsSenderInstance } from './fixtures/senders/sms.js';
import { AccountKeyPair, GlobalAuthenticationContext, buildAccountToBeRegistered, validateSuccessfulLogin } from './utils.js';

describe('forgot password spec', { timeout: 10_000 }, function suite() {
	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it('recovers forgotten password via email (token is not encrypted)', async () => {
		/* REGISTER */
		const account = { ...buildAccountToBeRegistered(), pubKey: undefined } as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* CREATE FORGOT PASSWORD SESSION */
		await AuthEngineInstance.createForgotPasswordSession('readByEmail', account.email, 'email');

		expect(EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')).to.have.length(1);
		const forgotPasswordToken = EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')[0];

		/* CHANGE FORGOTTEN PASSWORD */
		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, newPassword);

		// sessions were logged out
		expect(OnForgottenPasswordChangedHookMock.calls).toStrictEqual([account.id]);

		// check old password is no longer valid
		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(authStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.authenticated).to.be.eq(undefined);

		// check new credentials are valid
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);

		/* CAN'T REUSE SAME TOKEN TWICE */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, newPassword);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Forgot password session identified by token '${forgotPasswordToken}' doesn't exist.`);
	});

	it('recovers forgotten password via email (token is encrypted)', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* CREATE FORGOT PASSWORD SESSION */
		await AuthEngineInstance.createForgotPasswordSession('readByUsername', account.username, 'email');

		expect(EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')).to.have.length(1);
		const forgotPasswordToken = EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')[0];

		/* CHANGE FORGOTTEN PASSWORD */
		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword(ForgotPasswordTokenEncryption.decrypt(AccountKeyPair.private, forgotPasswordToken), newPassword);

		/* AUTHENTICATE WITH NEW PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});

	it('recovers forgotten password via sms (token is not encrypted)', async () => {
		/* REGISTER */
		const account = { ...buildAccountToBeRegistered(), pubKey: undefined } as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* CREATE FORGOT PASSWORD SESSION */
		await AuthEngineInstance.createForgotPasswordSession('readByTelephone', account.telephone!, 'sms');

		expect(SmsSenderInstance.client.outboxFor(account.telephone!, 'sendForgotPasswordToken')).to.have.length(1);
		const forgotPasswordToken = SmsSenderInstance.client.outboxFor(account.telephone!, 'sendForgotPasswordToken')[0];

		/* CHANGE FORGOTTEN PASSWORD */
		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, newPassword);

		// sessions were logged out
		expect(OnForgottenPasswordChangedHookMock.calls).toStrictEqual([account.id]);

		// check old password is no longer valid
		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(authStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.authenticated).to.be.eq(undefined);

		// check new credentials are valid
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);

		/* CAN'T REUSE SAME TOKEN TWICE */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, newPassword);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Forgot password session identified by token '${forgotPasswordToken}' doesn't exist.`);
	});

	it('recovers forgotten password via sms (token is encrypted)', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* CREATE FORGOT PASSWORD SESSION */
		await AuthEngineInstance.createForgotPasswordSession('readByUsername', account.username, 'sms');

		expect(SmsSenderInstance.client.outboxFor(account.telephone!, 'sendForgotPasswordToken')).to.have.length(1);
		const forgotPasswordToken = SmsSenderInstance.client.outboxFor(account.telephone!, 'sendForgotPasswordToken')[0];

		/* CHANGE FORGOTTEN PASSWORD */
		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword(ForgotPasswordTokenEncryption.decrypt(AccountKeyPair.private, forgotPasswordToken), newPassword);

		/* AUTHENTICATE WITH NEW PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});

	it('fails to change forgotten password when providing invalid token', async () => {
		let err;
		try {
			await AuthEngineInstance.changeForgottenPassword('invalid-token', 'does not matter');
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Forgot password session identified by token '${'invalid-token'}' doesn't exist.`);
	});

	it('fails to change forgotten password when the account was meanwhile disabled', async () => {
		/* REGISTER */
		const account = { ...buildAccountToBeRegistered(), pubKey: undefined } as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* CREATE FORGOT PASSWORD SESSION */
		await AuthEngineInstance.createForgotPasswordSession('readByEmail', account.email, 'email');

		expect(EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')).to.have.length(1);
		let forgotPasswordToken = EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')[0];

		/* DISABLE ACCOUNT */
		const disableUntil = chrono.unixTime() + 1;
		await AuthEngineInstance.disableAccount(account.id, disableUntil, 'testing');

		/* CHANGE FORGOTTEN PASSWORD ON DISABLED ACCOUNT */
		let err;
		try {
			await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, 'does not matter');
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(err).to.haveOwnProperty('message', `Account with id ${account.id} is disabled until ${disableUntil}.`);

		// one time token was invalidated
		err = null;
		try {
			await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, 'does not matter');
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Forgot password session identified by token '${forgotPasswordToken}' doesn't exist.`);

		/* CHANGE FORGOTTEN PASSWORD ON ENABLED ACCOUNT */
		await chrono.sleep(1100);
		EmailSenderInstance.client.clearOutboxFor(account.email);

		await AuthEngineInstance.createForgotPasswordSession('readByEmail', account.email, 'email');
		expect(EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')).to.have.length(1);
		[forgotPasswordToken] = EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken');

		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, newPassword);

		/* AUTHENTICATE WITH NEW PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});

	it('fails to change forgotten password when providing new weak password', async () => {
		/* REGISTER */
		const account = { ...buildAccountToBeRegistered(), pubKey: undefined } as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* CREATE FORGOT PASSWORD SESSION */
		await AuthEngineInstance.createForgotPasswordSession('readByEmail', account.email, 'email');

		expect(EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')).to.have.length(1);
		const forgotPasswordToken = EmailSenderInstance.client.outboxFor(account.email, 'sendForgotPasswordToken')[0];

		/* CHANGE FORGOTTEN PASSWORD (WEAK PASSWORD) */
		let err;
		try {
			const newPassword = string.random({ length: PasswordLengthValidatorOptions.minLength - 1 });
			await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, newPassword);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.WEAK_PASSWORD);
		expect(err).to.haveOwnProperty(
			'message',
			`Password needs to contain at least ${PasswordLengthValidatorOptions.minLength} characters, but it has ${
				PasswordLengthValidatorOptions.minLength - 1
			} characters.`
		);

		// one time token was invalidated
		err = null;
		try {
			await AuthEngineInstance.changeForgottenPassword(forgotPasswordToken, 'does not matter');
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Forgot password session identified by token '${forgotPasswordToken}' doesn't exist.`);
	});

	it('aborts the create forgot password session if token delivery fails', async () => {
		/* REGISTER */
		const account = { ...buildAccountToBeRegistered(), pubKey: undefined } as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* EMAIL SEND WILL FAIL */
		EmailSenderInstance.client.deliveryWillFail = true;

		/* CREATE FORGOT PASSWORD SESSION */
		let err;
		try {
			await AuthEngineInstance.createForgotPasswordSession('readByEmail', account.email, 'email');
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Error).and.to.haveOwnProperty('message', 'Email client was configured to fail mail delivery');
		expect(MemoryCache.size).to.be.eq(0); // session was deleted cuz of delivery exception

		/* SMS SEND WILL FAIL */
		SmsSenderInstance.client.deliveryWillFail = true;

		/* CREATE FORGOT PASSWORD SESSION */
		err = null;
		try {
			await AuthEngineInstance.createForgotPasswordSession('readByTelephone', account.telephone!, 'sms');
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Error).and.to.haveOwnProperty('message', 'SMS mock client was configured to fail sms delivery');

		expect(MemoryCache.size).to.be.eq(0); // session was deleted cuz of delivery exception
	});

	it('fails to create forgot password session when providing unknown side channel for token delivery', async () => {
		/* REGISTER */
		const account = { ...buildAccountToBeRegistered(), pubKey: undefined } as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* CREATE FORGOT PASSWORD SESSION */
		const sideChannel = 'push-notifications';
		let unknownSideChannelErr;
		try {
			await AuthEngineInstance.createForgotPasswordSession('readByUsername', account.username, sideChannel as any);
		} catch (e) {
			unknownSideChannelErr = e;
		}

		expect(unknownSideChannelErr)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.UNKNOWN_CREATE_FORGOT_PASSWORD_SESSION_SIDE_CHANNEL);
		expect(unknownSideChannelErr).to.haveOwnProperty(
			'message',
			`Can't send forgot password token for account with id '${account.id}', because side channel type '${sideChannel}' is unknown.`
		);

		expect(MemoryCache.size).to.be.eq(0); // session was deleted cuz of unknown side channel exception
	});
});
