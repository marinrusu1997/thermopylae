import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { array, chrono } from '@thermopylae/lib.utils';
import type { UnixTimestamp } from '@thermopylae/core.declarations';
import keypair from 'keypair';
import {
	AccountStatus,
	AccountWithTotpSecret,
	AuthenticationContext,
	AuthenticationEngine,
	AuthenticationStatus,
	ErrorCodes,
	FailedAuthenticationModel,
	SuccessfulAuthenticationModel
} from '../lib';
import { AuthenticationStepName } from '../lib/types/enums';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { buildAccountToBeRegistered, generateTotp, GlobalAuthenticationContext, signChallengeNonce, validateSuccessfulLogin } from './utils';
import { EmailSenderInstance } from './fixtures/senders/email';
import { FailedAuthAttemptSessionMemoryRepository } from './fixtures/repositories/memory/failed-auth-session';
import { AuthenticationSessionMemoryRepository } from './fixtures/repositories/memory/auth-session';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';
import { OnAuthFromDifferentContextHookMock } from './fixtures/hooks';

describe('Authenticate spec', function suite() {
	this.timeout(10_000); // @fixme remove when having proper net

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it('fails to authenticate non existing accounts', async () => {
		const authenticationContext: AuthenticationContext = {
			username: 'non-existing-account',
			password: 'does not matter',
			deviceId: '',
			ip: ''
		};

		let err: Error | null = null;
		try {
			await AuthEngineInstance.authenticate(authenticationContext);
		} catch (e) {
			err = e;
		}

		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with username '${authenticationContext.username}' doesn't exist.`);
	});

	it('fails to authenticate users with non activated accounts', async () => {
		const account = { ...buildAccountToBeRegistered(), disabledUntil: AccountStatus.DISABLED_UNTIL_ACTIVATION } as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		const authenticationContext: AuthenticationContext = {
			username: account.username,
			password: 'does not matter',
			deviceId: '',
			ip: ''
		};

		let err: Error | null = null;
		try {
			await AuthEngineInstance.authenticate(authenticationContext);
		} catch (e) {
			err = e;
		}

		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with username '${authenticationContext.username}' doesn't exist.`);
	});

	it('fails to authenticate users with disabled accounts', async () => {
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		account.disabledUntil = chrono.unixTime() + 10;
		await AuthEngineInstance.disableAccount(account.id, account.disabledUntil, 'Test purposes');

		const authenticationContext: AuthenticationContext = {
			username: account.username,
			password: 'does not matter',
			deviceId: '',
			ip: ''
		};

		let err: Error | null = null;
		try {
			await AuthEngineInstance.authenticate(authenticationContext);
		} catch (e) {
			err = e;
		}

		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(err).to.haveOwnProperty('message', `Account with id ${account.id} is disabled until ${account.disabledUntil}.`);
	});

	it('fails to authenticate user when wrong secret provided, user gives up, expect not to leak disk memory for auth temp session', async () => {
		await AuthEngineInstance.register(buildAccountToBeRegistered());
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });

		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.have.property('code', ErrorCodes.INCORRECT_CREDENTIALS);

		const authSessionTTLMs = chrono.secondsToMilliseconds(AuthenticationEngineDefaultOptions.ttl.authenticationSession) + 50;
		await chrono.sleep(authSessionTTLMs);

		const authSession = await AuthenticationEngineDefaultOptions.repositories.authenticationSession.read(
			GlobalAuthenticationContext.username,
			GlobalAuthenticationContext.deviceId
		);
		expect(authSession).to.be.eq(null);
	});

	it('fails to authenticate user when challenge response nonce not found in session (i.e. never generated or generated but deleted)', async () => {
		await AuthEngineInstance.register(buildAccountToBeRegistered());

		const signatureOfTokenWhichWasNeverIssued = signChallengeNonce('token-which-was-never-issued');
		let authStatus = await AuthEngineInstance.authenticate({
			...GlobalAuthenticationContext,
			responseForChallenge: { signature: signatureOfTokenWhichWasNeverIssued, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);

		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		const signatureOfValidToken = signChallengeNonce(authStatus.token!);
		authStatus = await AuthEngineInstance.authenticate({
			...GlobalAuthenticationContext,
			responseForChallenge: { signature: signatureOfValidToken, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		validateSuccessfulLogin(authStatus);

		// prevent replay attack
		authStatus = await AuthEngineInstance.authenticate({
			...GlobalAuthenticationContext,
			responseForChallenge: { signature: signatureOfValidToken, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
	});

	it('fails to authenticate user when challenge nonce is signed with invalid private key', async () => {
		await AuthEngineInstance.register(buildAccountToBeRegistered());

		let authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		const signature = signChallengeNonce(authStatus.token!, keypair().private);
		authStatus = await AuthEngineInstance.authenticate({
			...GlobalAuthenticationContext,
			responseForChallenge: { signature, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
	});

	it('fails to authenticate user when invalid challenge nonce is signed with valid private key (unlikely to happen in real scenario)', async () => {
		await AuthEngineInstance.register(buildAccountToBeRegistered());

		let authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		const signature = signChallengeNonce('invalid token');
		authStatus = await AuthEngineInstance.authenticate({
			...GlobalAuthenticationContext,
			responseForChallenge: { signature, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
	});

	it('authenticates successfully after failure (2 factor auth enabled)', async () => {
		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);
		account = (await AccountRepositoryMongo.readById(account.id))!; // grab totp secret

		/* AUTHENTICATE WITH PASSWORD */
		const authenticationTime = chrono.unixTime();
		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(authStatus.error).to.be.eq(undefined);

		/* FAIL AUTH WITH TOTP */
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': 'invalid' });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(authStatus.error).to.not.be.eq(undefined);
		expect(EmailSenderInstance.client.outboxFor(account.email, 'notifyMultiFactorAuthenticationFailed')).to.be.ofSize(1);

		/* ENSURE SESSIONS EXIST */
		await expect(AuthenticationSessionMemoryRepository.read(account.username, GlobalAuthenticationContext.deviceId)).to.eventually.not.be.oneOf([
			null,
			undefined
		]);
		await expect(FailedAuthAttemptSessionMemoryRepository.read(account.username)).to.eventually.not.be.oneOf([null, undefined]);

		/* AUTHENTICATE SUCCESSFULLY */
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': generateTotp(account.totpSecret) });
		validateSuccessfulLogin(authStatus);

		expect(OnAuthFromDifferentContextHookMock.calls).to.be.ofSize(0); // first auth evar, trust me

		const successfulAuthentications = await AuthEngineInstance.getSuccessfulAuthentications(account.id);
		expect(successfulAuthentications).to.be.ofSize(1);

		expect(successfulAuthentications[0]).to.be.deep.eq({
			id: successfulAuthentications[0].id,
			accountId: account.id,
			ip: GlobalAuthenticationContext.ip,
			device: GlobalAuthenticationContext.device,
			location: GlobalAuthenticationContext.location,
			authenticatedAt: successfulAuthentications[0].authenticatedAt
		} as SuccessfulAuthenticationModel);
		expect(successfulAuthentications[0].authenticatedAt).to.be.within(authenticationTime - 2, authenticationTime + 2);

		await expect(AuthenticationSessionMemoryRepository.read(account.username, GlobalAuthenticationContext.deviceId)).to.eventually.be.oneOf([
			null,
			undefined
		]);
		await expect(FailedAuthAttemptSessionMemoryRepository.read(account.username)).to.eventually.be.oneOf([null, undefined]);
	});

	it('detects authentication from different device', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* AUTHENTICATE FROM ONE DEVICE */
		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		validateSuccessfulLogin(authStatus);
		expect(OnAuthFromDifferentContextHookMock.calls).to.be.ofSize(0); // first auth evar

		/* AUTHENTICATE FROM ANOTHER DEVICE */
		const authContext: AuthenticationContext = {
			...GlobalAuthenticationContext,
			device: {
				device: {
					type: 'smartphone',
					brand: 'iPhone',
					model: '11'
				},
				os: null,
				client: null,
				bot: null
			}
		};
		authStatus = await AuthEngineInstance.authenticate(authContext);
		validateSuccessfulLogin(authStatus);
		expect(OnAuthFromDifferentContextHookMock.calls).to.be.equalTo([account.id]);

		/* GET SUCCESSFUL AUTHENTICATIONS */
		const successfulAuthentications = await AuthEngineInstance.getSuccessfulAuthentications(account.id);
		expect(successfulAuthentications).to.be.ofSize(2);
	});

	it("doesn't allow authentication when recaptcha is required, but not provided, furthermore it can disable account on threshold", async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* ACTIVATE RECAPTCHA */
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha; i++) {
			await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });
		}

		/* PROVIDE NO RECAPTCHA */
		const authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.authenticated).to.be.eq(undefined);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.not.be.eq(undefined);
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(authStatus.error!.hard).to.haveOwnProperty('message', 'Account was disabled due to reached threshold of failed auth attempts.');
	});

	it('failed auth attempts are shared between auth sessions', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* REACH RECAPTCHA ON FIRST SESSION */
		let numberOfAuthAttempts = 0;
		let recaptchaThreshold = AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha - 1;
		while (recaptchaThreshold--) {
			const status = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, deviceId: 'device1', password: 'invalid' });
			expect(status.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
			expect(status.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
			numberOfAuthAttempts += 1;
		}

		/* REACH DISABLE ON SECOND SESSION */
		let numberOfTriesTillAccountLock =
			AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha;
		while (numberOfTriesTillAccountLock--) {
			const status = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, deviceId: 'device2', password: 'invalid' });
			expect(status.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.RECAPTCHA_THRESHOLD_REACHED);
			expect(status.nextStep).to.be.eq(AuthenticationStepName.RECAPTCHA);
			numberOfAuthAttempts += 1;
		}

		expect(numberOfAuthAttempts).to.be.eq(AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha);

		/* DISABLE ACCOUNT ON THIRD SESSION */
		const status = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, deviceId: 'device3', password: 'invalid' });
		expect(status.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('disables the user account when providing invalid response to challenge', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* FAILED AUTH UNTIL ACCOUNT DISABLE */
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, generateChallenge: true });
			const authStatus = await AuthEngineInstance.authenticate({
				...GlobalAuthenticationContext,
				responseForChallenge: { signature: 'invalid signature', signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
			});

			if (authStatus.error!.soft) {
				expect(authStatus.error!.soft).to.be.instanceOf(Exception);
				expect(authStatus.error!.soft!.code).to.be.oneOf([ErrorCodes.INCORRECT_CREDENTIALS, ErrorCodes.RECAPTCHA_THRESHOLD_REACHED]);
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);

				continue;
			}

			if (authStatus.error!.hard) {
				expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

				continue;
			}

			throw new Error('Authentication should fail.');
		}

		/* ENSURE ACCOUNT IS DISABLED */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('authenticates user after soft error occurred in secret step, expect failed auth session to be cleared', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* AUTH FAILURE */
		await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });

		/* AUTH SUCCESS */
		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		validateSuccessfulLogin(authStatus);

		/* AUTH FAILURES AGAIN */
		// now retry again till hard error, counter needs to be 0 again
		let maxAllowedFailedAuthAttempts = AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - 1; // on last it will disable account
		// eslint-disable-next-line no-plusplus
		while (maxAllowedFailedAuthAttempts--) {
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });
			expect(authStatus.error!.soft).to.not.be.eq(undefined);
			expect(authStatus.error!.hard).to.be.eq(undefined);
		}

		const failedAuthAttemptsSession = (await FailedAuthAttemptSessionMemoryRepository.read(account.username))!;
		expect(failedAuthAttemptsSession.counter).to.be.eq(AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - 1);
	});

	it('authenticates after soft errors occurred in secret step and recaptcha was activated (multi factor auth disabled)', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* AUTHENTICATIONS */
		async function authenticateAfterSoftErrorInRecaptchaStep() {
			let authStatus: AuthenticationStatus<AccountWithTotpSecret> = {};

			let recaptchaThreshold = AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha;
			while (recaptchaThreshold--) {
				authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });
			}
			expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.RECAPTCHA);

			// now provide correct info along with correct recaptcha
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, recaptcha: 'valid' }); // this is how validator is implemented
			validateSuccessfulLogin(authStatus);
		}

		// try first time
		await authenticateAfterSoftErrorInRecaptchaStep();

		// try second time, should work, as auth session along with failed auth attempts sessions were destroyed
		await authenticateAfterSoftErrorInRecaptchaStep();
	});

	it('authenticates after soft errors occurred in secret step and recaptcha was activated (multi factor auth enabled)', async () => {
		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* ENABLE 2FA */
		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);
		account = (await AuthenticationEngineDefaultOptions.repositories.account.readById(account.id))!; // get totp secret from repository

		/* TRIGGER RECAPTCHA */
		let authStatus: AuthenticationStatus<AccountWithTotpSecret> = {};

		let recaptchaThreshold = AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha;
		while (recaptchaThreshold--) {
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });
		}
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.RECAPTCHA);

		/* PROVIDE RECAPTCHA */
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, recaptcha: 'valid' });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

		/* CONTINUE 2FA */
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': generateTotp(account.totpSecret) });
		validateSuccessfulLogin(authStatus);
	});

	it('aborts authentication after hard error occurred in secret step (recaptcha not required and mfa disabled)', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* TRIGGER ACCOUNT DISABLE */
		let authStatus: AuthenticationStatus<AccountWithTotpSecret>;
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });
		}
		expect(authStatus!.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		/* TRY AUTHENTICATE WITH DISABLED ACCOUNT */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('aborts authentication after hard error occurred in recaptcha step (mfa disabled)', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* TRIGGER RECAPTCHA */
		let authStatus: AuthenticationStatus<AccountWithTotpSecret> = {};
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha; i++) {
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });
		}
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.RECAPTCHA);

		/* PROVIDE INVALID RECAPTCHA */
		for (
			let i = AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha;
			i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts;
			i++
		) {
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, recaptcha: 'invalid' });
		}
		expect(authStatus!.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		/* TRY AUTHENTICATE WITH DISABLED ACCOUNT */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('aborts authentication after hard error occurred in mfa step (recaptcha required)', async () => {
		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* ENABLE 2FA */
		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);
		account = (await AuthenticationEngineDefaultOptions.repositories.account.readById(account.id))!; // get totp secret from repository

		/* TRIGGER RECAPTCHA */
		let authStatus: AuthenticationStatus<AccountWithTotpSecret> = {};
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha; i++) {
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: 'invalid' });
		}
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.RECAPTCHA);

		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, recaptcha: 'valid' });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

		/* PROVIDE INVALID TOTP */
		for (
			let i = AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha;
			i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts;
			i++
		) {
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': 'invalid' });
		}
		expect(authStatus!.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		/* TRY AUTHENTICATE WITH DISABLED ACCOUNT */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('stores failed auth attempts after account was disabled when failure threshold reached (only the last one ip and device)', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* BUILD IP & DEVICE_ID POOLS */
		const POOL_SIZE = 50;
		const ipPool = new Array<string>(POOL_SIZE);
		for (let i = 0; i < POOL_SIZE; i++) {
			ipPool[i] = `ip${i}`;
		}

		/* TRIGGER ACCOUNT DISABLE */
		let lastIp: string | undefined;
		let authStatus: AuthenticationStatus<AccountWithTotpSecret> = {};
		let authenticationTime: UnixTimestamp = 0;
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			lastIp = array.randomElement(ipPool);
			authenticationTime = chrono.unixTime();
			authStatus = await AuthEngineInstance.authenticate({
				...GlobalAuthenticationContext,
				password: 'invalid',
				ip: lastIp
			});
		}
		expect(authStatus!.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		/* READ FAILED AUTHENTICATIONS */
		const failedAuthAttempts = await AuthEngineInstance.getFailedAuthentications(account.id);
		expect(failedAuthAttempts).to.be.ofSize(1);

		expect(failedAuthAttempts[0]).to.be.deep.eq({
			id: failedAuthAttempts[0].id,
			accountId: account.id,
			ip: lastIp,
			device: GlobalAuthenticationContext.device,
			location: GlobalAuthenticationContext.location,
			detectedAt: failedAuthAttempts[0].detectedAt
		} as FailedAuthenticationModel);
		expect(failedAuthAttempts[0].detectedAt).to.be.within(authenticationTime - 1, authenticationTime + 1);
	});

	it("enables account on next authentication after it's disable timeout expires", async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* TRIGGER ACCOUNT DISABLE */
		let authStatus: AuthenticationStatus<AccountWithTotpSecret> = {};
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			authStatus = await AuthEngineInstance.authenticate({
				...GlobalAuthenticationContext,
				password: 'invalid'
			});
		}
		expect(authStatus!.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		await expect(AuthenticationSessionMemoryRepository.read(account.username, GlobalAuthenticationContext.deviceId)).to.eventually.be.oneOf([
			null,
			undefined
		]);

		/* TRY AUTHENTICATE WITH DISABLED ACCOUNT (SHOULD FAIL) */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		/* AUTHENTICATE AFTER LOCKOUT EXPIRES */
		await chrono.sleep(chrono.secondsToMilliseconds(AuthenticationEngineDefaultOptions.ttl.accountDisableTimeout) + 50);

		authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		validateSuccessfulLogin(authStatus);
	});

	it('authenticates the user using challenge response authentication method', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* REQUEST CHALLENGE */
		let authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		/* SEND CHALLENGE */
		authStatus = await AuthEngineInstance.authenticate({
			...GlobalAuthenticationContext,
			responseForChallenge: {
				signature: signChallengeNonce(authStatus.token!),
				signAlgorithm: 'RSA-SHA512',
				signEncoding: 'base64'
			}
		});
		validateSuccessfulLogin(authStatus);

		// session was deleted, prevent replay attacks with already emitted nonce
		await expect(AuthenticationSessionMemoryRepository.read(account.username, GlobalAuthenticationContext.deviceId)).to.eventually.be.oneOf([
			null,
			undefined
		]);
	});

	it('authenticates user having password hashed with algorithm different than current one', async () => {
		expect(Array.from(AuthenticationEngineDefaultOptions.password.hashing.algorithms.keys())).to.be.equalTo([0, 1]);
		expect(AuthenticationEngineDefaultOptions.password.hashing.currentAlgorithmId).to.be.eq(0);

		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		const password = account.passwordHash;
		await AuthEngineInstance.register(account);

		/* CHANGE PASSWORD WITH ALGORITHM */
		const hash = await AuthenticationEngineDefaultOptions.password.hashing.algorithms.get(1)!.hash(password);
		await AccountRepositoryMongo.changePassword(account.id, hash.passwordHash, hash.passwordSalt, 1);

		/* AUTHENTICATE */
		const authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		validateSuccessfulLogin(authStatus);
	});
});
