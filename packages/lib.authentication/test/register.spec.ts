import { describe, it } from 'mocha';
import { expect } from '@thermopylae/lib.unit-test';
import { Exception } from '@thermopylae/lib.exception';
import { AccountStatus, AccountToBeRegistered, AccountWithTotpSecret, AuthenticationContext, AuthenticationEngine, ErrorCodes } from '../lib';
import { AuthenticationEngineDefaultOptions } from './fixtures';
import { EmailSenderInstance } from './fixtures/senders/email';
import { ActivateAccountSessionMemoryRepository } from './fixtures/repositories/memory/activate-account-session';
import { AccountRepositoryMongo } from './fixtures/repositories/mongo/account';

function buildAccountToBeRegistered(): AccountToBeRegistered<AccountWithTotpSecret> {
	return {
		username: 'username',
		passwordHash: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		disabledUntil: AccountStatus.ENABLED
	};
}

describe('Account registration spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	// @ts-ignore
	const authenticationContext: AuthenticationContext = {
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

	/*
	it('activates account using token sent via email at the registration', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		// @ts-ignore
		const activationToken = JSON.parse(
			AuthenticationEngineDefaultOptions['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string
		);
		await AuthEngineInstance.activateAccount(activationToken.token);

		await chrono.sleep(1500); // wait for scheduleDeletion account scheduler timer to finish

		const account = await AuthenticationEngineDefaultOptions.repositories.account.readByUsername(defaultRegistrationInfo.username);
		if (!account) {
			throw new Error('Account not found. Delete account scheduling was not cancelled.');
		}
		expect(account.disabledUntil).to.be.equal(true); // account was activated

		const activateAccountSession = await AuthenticationEngineDefaultOptions.repositories.activateAccountSession.read(activationToken.token);
		expect(activateAccountSession).to.be.eq(null); // activate account session was deleted
	});

	it('activate account will not fail if scheduleDeletion activate account session deletion will fail', async () => {
		// timer cancel is not allowed to throw, so operation can fail only if account status can't be changed to activated
		failureWillBeGeneratedForSessionOperation(SESSIONS_OP.ACTIVATE_ACCOUNT_SESSION_DELETE);

		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		// @ts-ignore
		const activationToken = JSON.parse(
			AuthenticationEngineDefaultOptions['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string
		);
		await AuthEngineInstance.activateAccount(activationToken.token);

		const account = await AuthenticationEngineDefaultOptions.repositories.account.readByUsername(defaultRegistrationInfo.username);
		if (!account) {
			throw new Error('Account not found. Delete account scheduling was not cancelled.');
		}
		expect(account.disabledUntil).to.be.equal(true); // account was activated

		const activateAccountSession = await AuthenticationEngineDefaultOptions.repositories.activateAccountSession.read(activationToken.token);
		expect(activateAccountSession).to.not.be.eq(null); // activate account session was not deleted with the explicit call, will be deleted later by his own timer
	});

	it("doesn't activate account if provided token is not valid", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		try {
			await AuthEngineInstance.activateAccount('invalid-token');
			assert(false, 'Account activated with invalid token');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
			expect(e).to.haveOwnProperty('message', `Activate account session identified by provided token invalid-token not found. `);
		}

		// @ts-ignore
		const activationToken = JSON.parse(
			AuthenticationEngineDefaultOptions['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string
		);
		await AuthEngineInstance.activateAccount(activationToken.token); // this will cancel scheduleDeletion account timer
	});

	it("doesn't activate account if canceling account deletion failed", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });

		failureWillBeGeneratedWhenScheduling(SCHEDULING_OP.CANCEL_DELETION_OF_UNACTIVATED_ACCOUNT);
		try {
			// @ts-ignore
			const activationToken = JSON.parse(
				AuthenticationEngineDefaultOptions['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string
			);
			await AuthEngineInstance.activateAccount(activationToken.token);
		} catch (e) {
			expect(e).to.not.be.instanceOf(Exception);
			expect(e).to.haveOwnProperty('message', 'Canceling deletion of unactivated account was configured to fail');
			const authStatus = await AuthEngineInstance.authenticate(authenticationContext);
			expect(authStatus.error!.hard).to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
			return;
		}
		assert(false, 'Account was activated, even if canceling account deletion failed.');
	});

	it('will scheduleDeletion account if not activated in specified amount of time (also deletes activate account session)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		// @ts-ignore
		const activationToken = JSON.parse(
			AuthenticationEngineDefaultOptions['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string
		);

		await chrono.sleep(1100); // wait timers to clean up resources

		const activateAccountSession = await AuthenticationEngineDefaultOptions.repositories.activateAccountSession.read(activationToken.token);
		expect(activateAccountSession).to.be.eq(null);
		const account = await AuthenticationEngineDefaultOptions.repositories.account.readByUsername(defaultRegistrationInfo.username);
		expect(account).to.be.eq(null);
	});

	it('will scheduleDeletion account if scheduling deletion of unactivated account failed', async () => {
		failureWillBeGeneratedWhenScheduling(SCHEDULING_OP.DELETE_UNACTIVATED_ACCOUNT);
		try {
			await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
			assert(false, 'Non-activated account was registered, even if scheduling deletion of unactivated account failed');
		} catch (e) {
			expect(e).to.be.instanceOf(Error, 'Scheduling scheduleDeletion unactivated account was configured to fail');
			const account = await AuthenticationEngineDefaultOptions.repositories.account.readByUsername(defaultRegistrationInfo.username);
			expect(account).to.be.eq(null);
			expect(hasActiveTimers()).to.be.eq(false);
			expect(hasAnySessions()).to.be.eq(false);
		}
	});

	it('will scheduleDeletion account and cancel account account deletion if creating activate account session failed', async () => {
		failureWillBeGeneratedForSessionOperation(SESSIONS_OP.ACTIVATE_ACCOUNT_SESSION_CREATE);
		try {
			await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
			assert(false, 'Non-activated account was registered, even if creation of activate account session failed');
		} catch (e) {
			expect(e).to.be.instanceOf(Error, 'Creation of activate account session was configured to fail.');
			const account = await AuthenticationEngineDefaultOptions.repositories.account.readByUsername(defaultRegistrationInfo.username);
			expect(account).to.be.eq(null);
			expect(hasActiveTimers()).to.be.eq(false);
			expect(hasAnySessions()).to.be.eq(false);
		}
	});

	it('will scheduleDeletion account, activate session, cancel timers if activate link delivery via email failed', async () => {
		// @ts-ignore
		AuthenticationEngineDefaultOptions['side-channels'].email.client.deliveryWillFail(true);
		try {
			await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
			assert(false, 'Non-activated account was registered, even if delivery of activate link failed');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', EmailErrorCodes.EMAIL_DELIVERY_FAILED);
			expect(e).to.haveOwnProperty('message', 'Email client was configured to fail mail delivery');

			const account = await AuthenticationEngineDefaultOptions.repositories.account.readByUsername(defaultRegistrationInfo.username);
			expect(account).to.be.eq(null);
			expect(hasActiveTimers()).to.be.eq(false);
			expect(hasAnySessions()).to.be.eq(false);
		}
	}); */
});
