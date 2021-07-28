import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { chrono, string } from '@thermopylae/lib.utils';
import { AuthenticationEngineDefaultOptions, PasswordLengthValidatorOptions } from './fixtures';
import { AccountStatus, AccountWithTotpSecret, AuthenticationEngine, ErrorCodes } from '../lib';
import { buildAccountToBeRegistered, GlobalAuthenticationContext, validateSuccessfulLogin } from './utils';
import { EmailSenderInstance } from './fixtures/senders/email';
import { OnAccountDisabledHookMock, OnPasswordChangedHookMock } from './fixtures/hooks';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';

describe('Change password spec', function suite() {
	this.timeout(10_000); // @fixme remove when having proper net

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it('changes password and then logs in with updated one', async () => {
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

	it('changes password that was hashed with an algorithm that differs from the current one', async () => {
		expect(Array.from(AuthenticationEngineDefaultOptions.password.hashing.algorithms.keys())).to.be.equalTo([0, 1]);
		expect(AuthenticationEngineDefaultOptions.password.hashing.currentAlgorithmId).to.be.eq(0);

		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		const oldPassword = account.passwordHash;
		await AuthEngineInstance.register(account);

		/* HASH WITH ANOTHER ALGORITHM */
		const hash = await AuthenticationEngineDefaultOptions.password.hashing.algorithms.get(1)!.hash(oldPassword);
		await AccountRepositoryMongo.changePassword(account.id, hash.passwordHash, hash.passwordSalt, 1);

		/* CHANGE PASSWORD */
		const newPassword = '8ujig05nf!/th89u|}//76ujhtg';
		await AuthEngineInstance.changePassword({
			accountId: account.id,
			oldPassword,
			newPassword,
			ip: '127.0.0.1'
		});

		/* AUTHENTICATE WITH NEW PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});

	it('fails to change password if provided account id is not valid', async () => {
		let err;
		const accountId = string.random({ length: 12 });
		try {
			await AuthEngineInstance.changePassword({
				accountId,
				oldPassword: 'does not matter',
				newPassword: 'does not matter',
				ip: '127.0.0.1'
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} doesn't exist.`);
	});

	it('fails to change password if account is disabled', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);
		await AuthEngineInstance.disableAccount(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION, 'test purposes');

		/* CHANGE PASSWORD */
		let err;
		try {
			await AuthEngineInstance.changePassword({
				accountId: account.id,
				oldPassword: 'does not matter',
				newPassword: 'does not matter',
				ip: '127.0.0.1'
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(err).to.haveOwnProperty('message', `Account with id ${account.id} is disabled until it won't be activated.`);
	});

	it('fails to change password if the old one provided is not valid', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		let oldPassword = account.passwordHash;
		await AuthEngineInstance.register(account);

		/* FAIL TO CHANGE PASSWORD UNTIL ACCOUNT MIGHT BE DISABLED */
		let err: Exception | null = null;
		for (let i = 1; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			err = null;

			try {
				await AuthEngineInstance.changePassword({
					accountId: account.id,
					oldPassword: 'invalid',
					newPassword: 'does not matter',
					ip: '127.0.0.1'
				});
			} catch (e) {
				err = e;
			}
			expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_PASSWORD);
			expect(err).to.haveOwnProperty('message', `Can't change password for account with id ${account.id}, because old passwords doesn't match.`);
		}

		/* CHANGE PASSWORD */
		let newPassword = 'u52ufji598!/.0t99kot';
		await AuthEngineInstance.changePassword({
			accountId: account.id,
			oldPassword,
			newPassword,
			ip: '127.0.0.1'
		});
		oldPassword = newPassword;

		/* FAIL TO CHANGE PASSWORD UNTIL ACCOUNT IS DISABLED */
		for (let i = 0; i < AuthenticationEngineDefaultOptions.thresholds.maxFailedAuthAttempts; i++) {
			err = null;

			try {
				await AuthEngineInstance.changePassword({
					accountId: account.id,
					oldPassword: 'invalid',
					newPassword: 'does not matter',
					ip: '127.0.0.1'
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

		/* CHANGE PASSWORD */
		newPassword = '8ujig05nf!/th89u|}//76ujhtg';
		await AuthEngineInstance.changePassword({
			accountId: account.id,
			oldPassword,
			newPassword,
			ip: '127.0.0.1'
		});

		/* AUTHENTICATE WITH NEW PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});

	it('fails to change password if the new one is the same (or almost same) as the old one', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		const oldPassword = account.passwordHash;
		await AuthEngineInstance.register(account);

		/* CHANGE WITH SAME PASSWORD */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.changePassword({
				accountId: account.id,
				oldPassword,
				newPassword: oldPassword,
				ip: '127.0.0.1'
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SIMILAR_PASSWORDS);
		expect(err).to.haveOwnProperty(
			'message',
			`Can't change password for account with id ${account.id}, because new password is too similar with the old one.`
		);

		/* CHANGE WITH SIMILAR PASSWORD */
		err = null;
		try {
			await AuthEngineInstance.changePassword({
				accountId: account.id,
				oldPassword,
				newPassword: `${oldPassword}.`,
				ip: '127.0.0.1'
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SIMILAR_PASSWORDS);
		expect(err).to.haveOwnProperty(
			'message',
			`Can't change password for account with id ${account.id}, because new password is too similar with the old one.`
		);

		/* CHANGE PASSWORD */
		const newPassword = '8ujig05nf!/th89u|}//76ujhtg';
		await AuthEngineInstance.changePassword({
			accountId: account.id,
			oldPassword,
			newPassword,
			ip: '127.0.0.1'
		});

		/* AUTHENTICATE WITH NEW PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});

	it('fails to change password if the new one is weak', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		const oldPassword = account.passwordHash;
		await AuthEngineInstance.register(account);

		/* CHANGE WITH WEAK PASSWORD */
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.changePassword({
				accountId: account.id,
				oldPassword,
				newPassword: string.random({ length: PasswordLengthValidatorOptions.minLength - 1 }),
				ip: '127.0.0.1'
			});
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

		/* CHANGE PASSWORD */
		const newPassword = '8ujig05nf!/th89u|}//76ujhtg';
		await AuthEngineInstance.changePassword({
			accountId: account.id,
			oldPassword,
			newPassword,
			ip: '127.0.0.1'
		});

		/* AUTHENTICATE WITH NEW PASSWORD */
		const authStatus = await AuthEngineInstance.authenticate({ ...GlobalAuthenticationContext, password: newPassword });
		validateSuccessfulLogin(authStatus);
	});
});
