import { describe, it } from 'mocha';
import { assert, expect } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { chrono, string } from '@thermopylae/lib.utils';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { AccountStatus, AccountWithTotpSecret, AuthenticationEngine, ErrorCodes, OnTwoFactorEnabledHookResult, TotpTwoFactorAuthStrategy } from '../lib';
import { buildAccountToBeRegistered } from './utils';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';
import { OnAccountDisabledHookMock } from './fixtures/hooks';

describe('Two Factor Auth Enable spec', function suite() {
	this.timeout(10_000); // @fixme remove when having proper net

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it('enables two factor auth', async () => {
		assert(
			AuthenticationEngineDefaultOptions['2fa-strategy'] instanceof TotpTwoFactorAuthStrategy,
			'TotpTwoFactorAuthStrategy needs to be used in auth engine opts'
		);

		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* ENABLE 2FA */
		const twoFactorEnableResult = (await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true)) as OnTwoFactorEnabledHookResult;
		expect(twoFactorEnableResult.totpSecretQRImageUrl).to.match(/^data:image\/png;base64,/);

		account = (await AccountRepositoryMongo.readById(account.id))!;
		expect(account.mfa).to.be.eq(true);
		expect(typeof account.totpSecret).to.be.eq('string');
	});

	it("doesn't enable 2fa for non existing accounts", async () => {
		/* ENABLE 2FA */
		const accountId = string.random({ length: 12 });

		let err;
		try {
			await AuthEngineInstance.setTwoFactorAuthEnabled(accountId, true);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} doesn't exist.`);
	});

	it("doesn't enable 2fa for disabled accounts", async () => {
		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);
		await AuthEngineInstance.disableAccount(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION, 'test purposes');

		/* ENABLE 2FA */
		let err;
		try {
			await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true);
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(err).to.haveOwnProperty('message', `Account with id ${account.id} is disabled until it won't be activated.`);

		account = (await AccountRepositoryMongo.readById(account.id))!;
		expect(account.mfa).to.be.eq(false);
		expect(typeof account.totpSecret).to.be.eq('undefined');
	});

	it('fails to change 2fa if the password provided is not valid', async () => {
		/* REGISTER */
		let account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		const password = account.passwordHash;
		await AuthEngineInstance.register(account);

		/* FAIL TO CHANGE 2 FA UNTIL ACCOUNT MIGHT BE DISABLED */
		let err: Exception | null = null;
		for (let i = 1; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			err = null;

			try {
				await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true, {
					ip: '127.0.0.1',
					password: 'invalid'
				});
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_PASSWORD);
			expect(err).to.haveOwnProperty(
				'message',
				`Can't set two factor authentication for account with id ${account.id}, because given password doesn't match with the account one.`
			);

			account = (await AccountRepositoryMongo.readById(account.id))!;
			expect(account.mfa).to.be.eq(false);
		}

		/* CHANGE 2 FA */
		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true, {
			ip: '127.0.0.1',
			password
		});
		account = (await AccountRepositoryMongo.readById(account.id))!;
		expect(account.mfa).to.be.eq(true);

		/* FAIL TO CHANGE 2 FA UNTIL ACCOUNT IS DISABLED */
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			err = null;

			try {
				await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, true, {
					ip: '127.0.0.1',
					password: 'invalid'
				});
			} catch (e) {
				err = e;
			}
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(err).to.haveOwnProperty(
			'message',
			`Password verification for account with id ${account.id} failed too many times, therefore account was disabled.`
		);
		expect(OnAccountDisabledHookMock.calls).to.be.ofSize(1); // sessions were invalidated

		/* WAIT ACCOUNT ENABLE */
		await chrono.sleep(chrono.secondsToMilliseconds(AuthenticationEngineDefaultOptions.ttl.accountDisableTimeout) + 50);

		/* CHANGE 2 FA */
		await AuthEngineInstance.setTwoFactorAuthEnabled(account.id, false, {
			ip: '127.0.0.1',
			password
		});
		account = (await AccountRepositoryMongo.readById(account.id))!;
		expect(account.mfa).to.be.eq(false);
	});
});
