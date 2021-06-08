import { describe, it } from 'mocha';
import { assert, expect } from '@thermopylae/lib.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { chrono } from '@thermopylae/lib.utils';
import { createSign } from 'crypto';
// @ts-ignore
import keypair from 'keypair';
import {
	AccountStatus,
	AccountToBeRegistered,
	AccountWithTotpSecret,
	AuthenticationContext,
	AuthenticationEngine,
	AuthenticationStatus,
	ErrorCodes,
	SuccessfulAuthenticationModel,
	TotpTwoFactorAuthStrategy
} from '../lib';
import { AuthenticationStepName } from '../lib/types/enums';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { generateTotp, validateSuccessfulLogin } from './utils';
import { EmailSenderInstance } from './fixtures/senders/email';
import { FailedAuthAttemptSessionMemoryRepository } from './fixtures/repositories/memory/failed-auth-session';
import { AuthenticationSessionMemoryRepository } from './fixtures/repositories/memory/auth-session';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';

const accountKeyPair = keypair();

function buildAccountToBeRegistered(): AccountToBeRegistered<AccountWithTotpSecret> {
	return {
		username: 'username',
		passwordHash: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		disabledUntil: AccountStatus.ENABLED,
		pubKey: accountKeyPair.public
	};
}

function signChallengeNonce(nonce: string, privateKey?: string): string {
	return createSign('RSA-SHA512')
		.update(nonce)
		.sign(privateKey || accountKeyPair.private, 'base64');
}

describe.only('Authenticate spec', function suite() {
	this.timeout(10_000); // @fixme remove when having proper net

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	const GlobalAuthenticationContext: AuthenticationContext = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		ip: '158.56.89.230',
		deviceId: 'ah93y5928735yyhauihf98par',
		device: {
			device: {
				type: 'smartphone',
				brand: 'Android',
				model: '9'
			},
			os: {
				name: 'Linux',
				version: '20',
				platform: 'ARM'
			},
			client: {
				name: 'Thermopylae',
				type: 'mobile app',
				version: ''
			},
			bot: null
		},
		location: {
			countryCode: 'US',
			regionCode: 'CA',
			city: 'Los Angeles',
			timezone: 'America/Los_Angeles',
			latitude: 34.0577507019043,
			longitude: -118.41380310058594
		}
	};
	Object.freeze(GlobalAuthenticationContext);

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

	// @fixme move to 2fa section
	it('returns soft error when totp was not valid', async () => {
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);
		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);

		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(authStatus.authenticated).to.be.eq(undefined);

		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': "some garbage, we don't care" });

		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.instanceOf(Exception);
		expect(authStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.error!.soft).to.haveOwnProperty(
			'message',
			`Credentials are not valid. Remaining attempts (${AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - 1}).`
		);

		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
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

		expect(EmailSenderInstance.client.outboxFor(account.email, 'notifyAuthenticationFromDifferentDevice')).to.be.ofSize(0); // first auth evar, trust me

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

	// @fixme move to 2fa policies with TotpTwoFactorAuthStrategy impl
	it("doesn't allow to bypass password step, by providing totp token directly without password", async () => {
		assert(
			AuthenticationEngineDefaultOptions['2fa-strategy'] instanceof TotpTwoFactorAuthStrategy,
			'TotpTwoFactorAuthStrategy needs to be used in auth engine opts'
		);

		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);
		account = (await AuthenticationEngineDefaultOptions.repositories.account.readById(account.id))!; // get totp secret from repository

		/* TRY BYPASS PASSWORD */
		let authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': 'password-bypassing' });
		const failedAuthAttemptsSession = (await AuthenticationEngineDefaultOptions.repositories.failedAuthAttemptSession.read(account.username))!;

		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(authStatus.authenticated).to.be.eq(undefined);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.not.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.error!.soft).to.haveOwnProperty(
			'message',
			`Credentials are not valid. Remaining attempts (${
				AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - failedAuthAttemptsSession.counter
			}).`
		);

		/* SEND TOTP TOO LATE */
		authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(authStatus.authenticated).to.be.eq(undefined);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.be.eq(undefined);

		// w8 till auth session that contains totp marker to expire
		await chrono.sleep(chrono.secondsToMilliseconds(AuthenticationEngineDefaultOptions.ttl.authenticationSession) + 50);

		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': generateTotp(account.totpSecret) });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(authStatus.authenticated).to.be.eq(undefined);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.not.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.RECAPTCHA_THRESHOLD_REACHED);
		expect(authStatus.error!.soft).to.haveOwnProperty(
			'message',
			`Credentials are not valid. Remaining attempts (${
				AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - failedAuthAttemptsSession.counter
			}).`
		);
	});

	// @fixme move to 2fa policies with TotpTwoFactorAuthStrategy impl
	it("doesn't allow to bypass 2 factor auth step, by not providing totp token", async () => {
		assert(
			AuthenticationEngineDefaultOptions['2fa-strategy'] instanceof TotpTwoFactorAuthStrategy,
			'TotpTwoFactorAuthStrategy needs to be used in auth engine opts'
		);

		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);
		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);

		/* AUTHENTICATE WITH PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(authStatus.authenticated).to.be.eq(undefined);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.be.eq(undefined);

		/* TRY CONTINUE AUTHENTICATION WITHOUT TOTP */
		let err: Error | null = null;
		try {
			await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY);
		expect(err).to.haveOwnProperty(
			'message',
			`Two factor authentication token was issued already for authentication session with id '${GlobalAuthenticationContext.deviceId}' belonging to account with id '${account.id}'.`
		);
	});

	// @fixme move to 2fa policies with TotpTwoFactorAuthStrategy impl
	it("can't use same totp twice (prevents replay attacks)", async () => {
		assert(
			AuthenticationEngineDefaultOptions['2fa-strategy'] instanceof TotpTwoFactorAuthStrategy,
			'TotpTwoFactorAuthStrategy needs to be used in auth engine opts'
		);

		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* ENABLE 2FA */
		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);
		account = (await AuthenticationEngineDefaultOptions.repositories.account.readById(account.id))!; // get totp secret from repository

		/* GENERATE 2FA TOKEN */
		let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
		const totp = generateTotp(account.totpSecret);

		/* VALIDATE 2FA TOKEN */
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': totp });
		validateSuccessfulLogin(authStatus);

		/* REPLAY 2FA TOKEN */
		authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, '2fa-token': totp });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(authStatus.authenticated).to.be.eq(undefined);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.not.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.error!.soft).to.haveOwnProperty(
			'message',
			`Credentials are not valid. Remaining attempts (${AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - 1}).`
		);
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
			let authStatus: AuthenticationStatus = {};

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
		let authStatus: AuthenticationStatus = {};

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
		let authStatus: AuthenticationStatus;
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
		let authStatus: AuthenticationStatus = {};
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
		let authStatus: AuthenticationStatus = {};
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
	/*

it('stores failed auth attempts after account was disabled when failure threshold reached (only the last one ip and device)', async () => {
    const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

    const POOL_SIZE = 100;
    const ipPool = [];
    const devicePool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
        ipPool.push(`ip${i}`);
        devicePool.push(`device${i}`);
    }

    let lastIp;
    let lastDevice;
    for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
        lastIp = ipPool[number.generateArbitrary(0, POOL_SIZE)];
        lastDevice = devicePool[number.generateArbitrary(0, POOL_SIZE)];
        await AuthEngineInstance.authenticate({
            ...validAuthRequest,
            password: 'invalid',
            ip: lastIp,
            device: lastDevice
        });
    }

    const failedAuthAttempts = await AuthEngineInstance.getFailedAuthentications(accountId);
    expect(failedAuthAttempts.length).to.be.eq(1);

    expect(failedAuthAttempts[0].ip).to.be.eq(lastIp);
    expect(failedAuthAttempts[0].device).to.be.eq(lastDevice);
});

it('disables account on reached failure threshold, even if storing failed auth attempts or deleting failed auth attempts session failed', async () => {
    failureWillBeGeneratedForEntityOperation(ENTITIES_OP.FAILED_AUTH_ATTEMPTS_CREATE);
    failureWillBeGeneratedForSessionOperation(SESSIONS_OP.FAILED_AUTH_ATTEMPTS_SESSION_DELETE);

    const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

    for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
        await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
    }

    const failedAuthAttempts = await AuthEngineInstance.getFailedAuthentications(accountId);
    expect(failedAuthAttempts.length).to.be.eq(0);

    const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
    expect(authStatus.token).to.be.eq(undefined);
    expect(authStatus.nextStep).to.be.eq(undefined);
    expect(authStatus.error!.soft).to.be.eq(undefined);
    expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
    expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
});

it('schedules account enabling when failed auth attempts threshold has been reached', async () => {
    const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

    for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
        await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
    }

    const failedAuthAttempts = await AuthEngineInstance.getFailedAuthentications(accountId);
    expect(failedAuthAttempts.length).to.be.eq(1);

    const expectedFailAuthStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
    expect(expectedFailAuthStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

    await chrono.sleep(chrono.minutesToSeconds(AuthenticationEngineConfig.thresholds!.enableAccountAfterAuthFailureDelayMinutes!) * 1000);

    await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);
}).timeout(5000);

it('schedules account enabling when failed auth attempts threshold has been reached only after disabling succeeded', async () => {
    failureWillBeGeneratedForEntityOperation(ENTITIES_OP.ACCOUNT_DISABLE);

    await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

    let thrownError;
    for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
        try {
            await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
        } catch (e) {
            thrownError = e;
        }
    }

    expect(hasActiveTimers()).to.be.eq(false);
    expect(thrownError).to.haveOwnProperty('message', 'Account disable was scheduled to fail');
});

it('keeps account disabled if account enabling failed after failed auth attempts threshold reached', async () => {
    failureWillBeGeneratedWhenScheduling(SCHEDULING_OP.ENABLE_ACCOUNT);

    await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

    let thrownError;
    for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
        try {
            await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
        } catch (e) {
            thrownError = e;
        }
    }

    expect(hasActiveTimers()).to.be.eq(false);
    expect(thrownError).to.haveOwnProperty('message', 'Scheduling account enabling was configured to fail');

    const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
    expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
});

it('keeps account disabled if creating failed auth attempt model failed', async () => {
    failureWillBeGeneratedForEntityOperation(ENTITIES_OP.FAILED_AUTH_ATTEMPTS_CREATE);

    await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

    for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
        await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
    }

    expect(hasActiveTimers()).to.be.eq(true);

    const expectedNegativeAuthStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
    expect(expectedNegativeAuthStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

    await chrono.sleep(chrono.minutesToSeconds(AuthenticationEngineConfig.thresholds!.enableAccountAfterAuthFailureDelayMinutes!) * 1000);

    await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);
}).timeout(5000);

it('authenticates the user using challenge response authentication method', async () => {
    await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

    const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, generateChallenge: true });
    expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
    expect(authStatus.token).to.not.be.eq(undefined);

    const signature = signChallengeNonce(authStatus.token!);
    const authRequest = {
        ...validAuthRequest,
        responseForChallenge: { signature, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' as HexBase64Latin1Encoding }
    };

    await validateSuccessfulLogin(AuthEngineInstance, authRequest);

    // session was deletion, prevent replay attacks with already emitted nonce
    expect(await AuthenticationEngineConfig.repositories.authenticationSession.read(defaultRegistrationInfo.username, validAuthRequest.device)).to.be.eq(
        null
    );
});

it('authenticates user having password hashed with old algorithm, after password hashing algorithm changes', async () => {
    const [authEngineHashAlg1, authEngineHashAlg2] = createAuthEnginesWithDifferentPasswordHashingAlg(AuthenticationEngineConfig);

    await authEngineHashAlg1.register(defaultRegistrationInfo, { enabled: true });

    await validateSuccessfulLogin(authEngineHashAlg2, validAuthRequest);
});

it('authenticates users having passwords hashed with different algorithms', async () => {
    const [authEngineHashAlg1, authEngineHashAlg2] = createAuthEnginesWithDifferentPasswordHashingAlg(AuthenticationEngineConfig);

    const account1 = defaultRegistrationInfo;
    const account2 = {
        ...defaultRegistrationInfo,
        username: string.generateStringOfLength(10),
        password: string.generateStringOfLength(30)
    };

    await authEngineHashAlg1.register(account1, { enabled: true });
    await authEngineHashAlg2.register(account2, { enabled: true });

    await validateSuccessfulLogin(authEngineHashAlg1, validAuthRequest);
    await validateSuccessfulLogin(authEngineHashAlg2, {
        ...validAuthRequest,
        username: account2.username,
        password: account2.password
    });
}); */
});
