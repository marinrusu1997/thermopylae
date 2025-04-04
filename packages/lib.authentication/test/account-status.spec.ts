import { Exception } from '@thermopylae/lib.exception';
import { json } from '@thermopylae/lib.utils';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AccountStatus, type AccountWithTotpSecret, AuthenticationEngine, ErrorCodes } from '../lib/index.js';
import { OnAccountDisabledHookMock } from './fixtures/hooks.js';
import { AuthenticationEngineDefaultOptions } from './fixtures/index.js';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account.js';
import { EmailSenderInstance } from './fixtures/senders/email.js';
import { buildAccountToBeRegistered } from './utils.js';

describe('Account Status spec', { timeout: 10_000 }, function suite() {
	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it('disables user account', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* DISABLE ACCOUNT */
		const cause = 'does not matter';
		await AuthEngineInstance.disableAccount(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION, cause);

		expect((await AccountRepositoryMongo.readById(account.id))!.disabledUntil).to.be.eq(AccountStatus.DISABLED_UNTIL_ACTIVATION);

		expect(OnAccountDisabledHookMock.calls).to.have.length(1);
		expect((JSON.parse(OnAccountDisabledHookMock.calls[0]) as AccountWithTotpSecret).disabledUntil).to.be.eq(AccountStatus.DISABLED_UNTIL_ACTIVATION);

		const userNotification: { account: AccountWithTotpSecret; cause: string } = json.TypedJson.parse(
			EmailSenderInstance.client.outboxFor(account.email, 'notifyAccountDisabled')[0]
		);
		expect(userNotification.account.disabledUntil).to.be.eq(AccountStatus.DISABLED_UNTIL_ACTIVATION);
		expect(userNotification.cause).to.be.eq(cause);

		const adminNotification: { account: AccountWithTotpSecret; cause: string } = json.TypedJson.parse(
			EmailSenderInstance.client.outboxFor(AuthenticationEngineDefaultOptions.email.admin, 'notifyAdminAboutAccountDisabling')[0]
		);
		expect(adminNotification.account.disabledUntil).to.be.eq(AccountStatus.DISABLED_UNTIL_ACTIVATION);
		expect(adminNotification.cause).to.be.eq(cause);
	});

	it('enables user account', async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* DISABLE ACCOUNT */
		const cause = 'does not matter';
		await AuthEngineInstance.disableAccount(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION, cause);
		expect((await AccountRepositoryMongo.readById(account.id))!.disabledUntil).to.be.eq(AccountStatus.DISABLED_UNTIL_ACTIVATION);

		/* ENABLE ACCOUNT */
		await AuthEngineInstance.enableAccount(account.id);
		expect((await AccountRepositoryMongo.readById(account.id))!.disabledUntil).to.be.eq(AccountStatus.ENABLED);
	});

	it("doesn't allow to disable twice same account", async () => {
		/* REGISTER */
		const account = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(account);

		/* DISABLE ACCOUNT */
		const cause = 'does not matter';
		await AuthEngineInstance.disableAccount(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION, cause);

		/* DISABLE TWICE */
		let err: Error | null = null;
		try {
			await AuthEngineInstance.disableAccount(account.id, AccountStatus.DISABLED_UNTIL_ACTIVATION, 'does not matter');
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it("fails to disable account if it wasn't found", async () => {
		let accountNotFoundErr;

		const accountId = crypto.randomBytes(12).toString('hex');

		try {
			await AuthEngineInstance.disableAccount(accountId, AccountStatus.DISABLED_UNTIL_ACTIVATION, 'does not matter');
		} catch (e) {
			accountNotFoundErr = e;
		}

		expect(accountNotFoundErr).to.be.instanceOf(Exception);
		expect(accountNotFoundErr).to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
		expect(accountNotFoundErr).to.haveOwnProperty('message', `Account with id ${accountId} doesn't exist.`);
	});
});
