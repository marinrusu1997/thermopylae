import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { chrono } from '@thermopylae/lib.utils';
import { ErrorCodes as CoreErrorCodes } from '@thermopylae/core.declarations';
import { AccountStatus, AccountWithTotpSecret, AuthenticationEngine, ErrorCodes } from '../lib';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { EmailSenderInstance } from './fixtures/senders/email';
import { ActivateAccountSessionMemoryRepository } from './fixtures/repositories/memory/activate-account-session';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';
import { buildAccountToBeRegistered } from './utils';

describe('Register spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	it('registers a new account', async () => {
		const accountToBeRegistered = buildAccountToBeRegistered() as AccountWithTotpSecret;
		await AuthEngineInstance.register(accountToBeRegistered);

		const account = await AuthenticationEngineDefaultOptions.repositories.account.readById(accountToBeRegistered.id);
		if (!account) {
			throw new Error('Registered account not found');
		}

		expect(accountToBeRegistered.id).to.be.eq(account.id);
		expect(accountToBeRegistered.username).to.be.eq(account.username);
		expect(accountToBeRegistered.passwordHash).to.be.eq(account.passwordHash);
		expect(accountToBeRegistered.passwordAlg).to.be.eq(account.passwordAlg);
		expect(accountToBeRegistered.email).to.be.eq(account.email);
		expect(accountToBeRegistered.telephone).to.be.eq(account.telephone);
		expect(accountToBeRegistered.disabledUntil).to.be.eq(account.disabledUntil);
		expect(accountToBeRegistered.mfa).to.be.eq(account.mfa);
	});

	it('fails to register new account if it is registered already', async () => {
		await AuthEngineInstance.register(buildAccountToBeRegistered());

		let err: Error | null = null;
		try {
			await AuthEngineInstance.register(buildAccountToBeRegistered());
		} catch (e) {
			err = e;
		}

		expect(err).to.not.be.eq(null);
		expect(err!.message).to.be.eq('E11000 duplicate key error dup key: { : "username" }');
	});

	it('fails to register new account if provided password is too weak', async () => {
		const errors = new Array<Exception>();

		try {
			await AuthEngineInstance.register({ ...buildAccountToBeRegistered(), passwordHash: 'sho' });
		} catch (e) {
			errors.push(e);
		}

		try {
			await AuthEngineInstance.register({ ...buildAccountToBeRegistered(), passwordHash: 'qwerty' });
		} catch (e) {
			errors.push(e);
		}

		try {
			await AuthEngineInstance.register({ ...buildAccountToBeRegistered(), passwordHash: '2307mgd73fn' });
		} catch (e) {
			errors.push(e);
		}

		expect(errors).to.be.ofSize(3);
		expect(errors[0].code).to.be.eq(ErrorCodes.WEAK_PASSWORD);
		expect(errors[0].message).to.be.eq('Password needs to contain at least 4 characters, but it has 3 characters.');

		expect(errors[1].code).to.be.eq(ErrorCodes.WEAK_PASSWORD);
		expect(errors[1].message).to.be.eq('This is a top-10 common password.\nAdd another word or two. Uncommon words are better.');

		expect(errors[2].code).to.be.eq(ErrorCodes.WEAK_PASSWORD);
		expect(errors[2].message).to.be.eq('Provided password has been breached before.');
	});

	it('fails to register accounts that are disabled until unix timestamp', async () => {
		const now = chrono.unixTime();

		let err: Exception | null = null;
		try {
			await AuthEngineInstance.register({ ...buildAccountToBeRegistered(), disabledUntil: now });
		} catch (e) {
			err = e;
		}

		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', CoreErrorCodes.MISCONFIGURATION);
		expect(err).to.haveOwnProperty(
			'message',
			`Account 'disabledUntil' field should take either ${AccountStatus.ENABLED} or ${AccountStatus.DISABLED_UNTIL_ACTIVATION} values. Given: ${now}.`
		);
	});

	it('activates account', async () => {
		/* REGISTER */
		const accountToBeRegistered = { ...buildAccountToBeRegistered(), disabledUntil: AccountStatus.DISABLED_UNTIL_ACTIVATION };
		await AuthEngineInstance.register(accountToBeRegistered);

		/* GET TOKEN FROM EMAIL */
		const emails = EmailSenderInstance.client.outboxFor(accountToBeRegistered.email, 'sendActivateAccountToken');
		expect(emails).to.be.ofSize(1);

		/* CHECK STORAGES */
		const activationToken = emails[0];
		await expect(ActivateAccountSessionMemoryRepository.read(activationToken)).to.eventually.be.deep.equal(accountToBeRegistered); // temp storage
		await expect(AccountRepositoryMongo.readByUsername(accountToBeRegistered.username)).to.eventually.be.eq(null); // not in permanent storage

		/* ACTIVATE ACCOUNT */
		await AuthEngineInstance.activateAccount(activationToken);
		expect(accountToBeRegistered.disabledUntil).to.be.eq(AccountStatus.ENABLED);

		/* CHECK STORAGES */
		await expect(ActivateAccountSessionMemoryRepository.read(activationToken)).to.eventually.be.equal(null); // deleted from temp storage, prevent replay attack
		await expect(AccountRepositoryMongo.readById((accountToBeRegistered as AccountWithTotpSecret).id)).to.eventually.be.deep.equal(accountToBeRegistered);
	});

	it("doesn't activate account if provided token is not valid", async () => {
		let err: Exception | null = null;
		try {
			await AuthEngineInstance.activateAccount('invalid-token');
		} catch (e) {
			err = e;
		}

		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Activate account session identified by token 'invalid-token' not found.`);
	});
});
