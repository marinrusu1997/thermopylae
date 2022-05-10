// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it } from 'mocha';
import { assert, expect } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { chrono } from '@thermopylae/lib.utils';
import {
	AccountWithTotpSecret,
	AuthenticationEngine,
	EmailTwoFactorAuthStrategy,
	ErrorCodes,
	SmsTwoFactorAuthStrategy,
	TotpTwoFactorAuthStrategy,
	TwoFactorAuthStrategy
} from '../lib';
import { AuthenticationStepName } from '../lib/types/enums';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { buildAccountToBeRegistered, generateTotp, GlobalAuthenticationContext, validateSuccessfulLogin } from './utils';
import { AuthenticationSessionMemoryRepository } from './fixtures/repositories/memory/auth-session';

describe('Two Factor Authentication spec', function suite() {
	this.timeout(10_000); // @fixme remove when having proper net

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	describe(`${TotpTwoFactorAuthStrategy.name} spec`, () => {
		it('returns soft error when totp was not valid', async () => {
			assert(
				AuthenticationEngineDefaultOptions.twoFactorAuthStrategy instanceof TotpTwoFactorAuthStrategy,
				'TotpTwoFactorAuthStrategy needs to be used in auth engine opts'
			);

			const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
			await AuthEngineInstance.register(account);
			await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);

			let authStatus = await AuthEngineInstance.authenticate(GlobalAuthenticationContext);
			expect(authStatus.token).to.be.eq(undefined);
			expect(authStatus.error).to.be.eq(undefined);
			expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
			expect(authStatus.authenticated).to.be.eq(undefined);

			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, twoFactorAuthenticationToken: "some garbage, we don't care" });

			expect(authStatus.token).to.be.eq(undefined);
			expect(authStatus.error!.soft).to.be.instanceOf(Exception);
			expect(authStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
			expect(authStatus.error!.soft).to.haveOwnProperty(
				'message',
				`Credentials are not valid. Remaining attempts (${AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts - 1}).`
			);

			expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		});

		it("doesn't allow to bypass password step, by providing totp token directly without password", async () => {
			assert(
				AuthenticationEngineDefaultOptions.twoFactorAuthStrategy instanceof TotpTwoFactorAuthStrategy,
				'TotpTwoFactorAuthStrategy needs to be used in auth engine opts'
			);

			/* REGISTER */
			let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
			await AuthEngineInstance.register(account);

			await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);
			account = (await AuthenticationEngineDefaultOptions.repositories.account.readById(account.id))!; // get totp secret from repository

			/* TRY BYPASS PASSWORD */
			let authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, twoFactorAuthenticationToken: 'password-bypassing' });
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

			authStatus = await AuthEngineInstance.authenticate({
				...GlobalAuthenticationContext,
				twoFactorAuthenticationToken: generateTotp(account.totpSecret)
			});
			expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
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
		});

		it("doesn't allow to bypass 2 factor auth step, by not providing totp token", async () => {
			assert(
				AuthenticationEngineDefaultOptions.twoFactorAuthStrategy instanceof TotpTwoFactorAuthStrategy,
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

		it("can't use same totp twice (prevents replay attacks)", async () => {
			assert(
				AuthenticationEngineDefaultOptions.twoFactorAuthStrategy instanceof TotpTwoFactorAuthStrategy,
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
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, twoFactorAuthenticationToken: totp });
			validateSuccessfulLogin(authStatus);

			/* REPLAY 2FA TOKEN */
			authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, twoFactorAuthenticationToken: totp });
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
	});

	describe(`${SmsTwoFactorAuthStrategy.name} & ${EmailTwoFactorAuthStrategy.name} spec`, () => {
		const tokens = new Map<string, string>();

		const strategies: Array<TwoFactorAuthStrategy<AccountWithTotpSecret>> = [
			new SmsTwoFactorAuthStrategy({
				sendSms: async (telephone, token) => {
					tokens.set(telephone, token);
				},
				tokenLength: 5
			}),
			new EmailTwoFactorAuthStrategy({
				sendEmail: async (email, token) => {
					tokens.set(email, token);
				},
				tokenLength: 5
			})
		];

		function getToken(strategy: TwoFactorAuthStrategy<AccountWithTotpSecret>, account: AccountWithTotpSecret): string {
			if (strategy instanceof SmsTwoFactorAuthStrategy) {
				return tokens.get(account.telephone!)!;
			}

			if (strategy instanceof EmailTwoFactorAuthStrategy) {
				return tokens.get(account.email)!;
			}

			throw new Error('Unknown 2fa strategy.');
		}

		for (const strategy of strategies) {
			const AuthenticationEngineInstance = new AuthenticationEngine({
				...AuthenticationEngineDefaultOptions,
				twoFactorAuthStrategy: strategy
			});

			it('authenticates with 2 factor auth code', async () => {
				/* REGISTER */
				const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
				await AuthenticationEngineInstance.register(account);

				/* ENABLE 2FA */
				await AuthenticationEngineInstance.setTwoFactorAuthEnabled(account.id, true);

				/* AUTHENTICATE WITH PASSWORD */
				let authStatus = await AuthenticationEngineInstance.authenticate(GlobalAuthenticationContext);
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

				/* AUTHENTICATE WITH 2 FACTOR TOKEN */
				authStatus = await AuthenticationEngineInstance.authenticate({
					...GlobalAuthenticationContext,
					twoFactorAuthenticationToken: getToken(strategy, account)
				});
				validateSuccessfulLogin(authStatus);
			});

			it("doesn't issue another token until last one wasn't validated", async () => {
				/* REGISTER */
				const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
				await AuthenticationEngineInstance.register(account);

				/* ENABLE 2FA */
				await AuthenticationEngineInstance.setTwoFactorAuthEnabled(account.id, true);

				/* AUTHENTICATE WITH PASSWORD */
				const authStatus = await AuthenticationEngineInstance.authenticate(GlobalAuthenticationContext);
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

				/* AUTHENTICATE WITH PASSWORD (AGAIN) */
				let err: Exception | null = null;
				try {
					await AuthenticationEngineInstance.authenticate(GlobalAuthenticationContext);
				} catch (e) {
					err = e;
				}
				expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY);
			});

			it("doesn't allow to login with another token", async () => {
				/* REGISTER */
				const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
				await AuthenticationEngineInstance.register(account);

				/* ENABLE 2FA */
				await AuthenticationEngineInstance.setTwoFactorAuthEnabled(account.id, true);

				/* AUTHENTICATE WITH PASSWORD */
				let authStatus = await AuthenticationEngineInstance.authenticate(GlobalAuthenticationContext);
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

				/* AUTHENTICATE WITH INVALID TOKEN */
				authStatus = await AuthenticationEngineInstance.authenticate({ ...GlobalAuthenticationContext, twoFactorAuthenticationToken: 'invalid' });
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
				expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
				expect(authStatus.token).to.be.eq(undefined);
				expect(authStatus.authenticated).to.be.eq(undefined);
			});

			it("doesn't allow to bypass password authentication", async () => {
				/* REGISTER */
				const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
				await AuthenticationEngineInstance.register(account);

				/* ENABLE 2FA */
				await AuthenticationEngineInstance.setTwoFactorAuthEnabled(account.id, true);

				/* AUTHENTICATE WITH INVALID TOKEN */
				const authStatus = await AuthenticationEngineInstance.authenticate({ ...GlobalAuthenticationContext, twoFactorAuthenticationToken: 'invalid' });
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD); // we bypassed password
				expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
				expect(authStatus.token).to.be.eq(undefined);
				expect(authStatus.authenticated).to.be.eq(undefined);
			});

			it('skips recaptcha when authentication reached 2fa step', async () => {
				/* REGISTER */
				const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
				await AuthenticationEngineInstance.register(account);

				/* ENABLE 2FA */
				await AuthenticationEngineInstance.setTwoFactorAuthEnabled(account.id, true);

				/* AUTHENTICATE WITH PASSWORD */
				let authStatus = await AuthenticationEngineInstance.authenticate(GlobalAuthenticationContext);
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

				/* TRIGGER RECAPTCHA */
				let recaptchaThreshold = AuthenticationEngineDefaultOptions.thresholds.failedAuthAttemptsRecaptcha;
				while (recaptchaThreshold--) {
					authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, twoFactorAuthenticationToken: 'invalid' });
				}
				expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
				expect((await AuthenticationSessionMemoryRepository.read(account.username, GlobalAuthenticationContext.deviceId))!.recaptchaRequired).to.be.eq(
					true
				);

				/* AUTHENTICATE WITH 2 FACTOR TOKEN */
				authStatus = await AuthenticationEngineInstance.authenticate({
					...GlobalAuthenticationContext,
					twoFactorAuthenticationToken: getToken(strategy, account)
				});
				validateSuccessfulLogin(authStatus);
			});
		}
	});
});
