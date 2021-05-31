import { describe, it } from 'mocha';
import { assert, expect } from 'chai';
import { chrono } from '@marin/lib.utils';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { Libraries } from '@marin/lib.utils/dist/declarations';
import { ErrorCodes as EmailErrorCodes } from '@marin/lib.email';
import Exception from '@marin/lib.error';
import { hostname } from 'os';
import { AuthenticationEngine, ErrorCodes } from '../lib';
import basicAuthEngineConfig from './fixtures';
import { failureWillBeGeneratedWhenScheduling, hasActiveTimers, SCHEDULING_OP } from './fixtures/schedulers';
import { failureWillBeGeneratedForSessionOperation, hasAnySessions, SESSIONS_OP } from './fixtures/memcache-entities';
import { AuthenticationContext } from '../lib/types/requests';

describe('Account registration spec', () => {
	const AuthEngineInstance = new AuthenticationEngine({
		...basicAuthEngineConfig,
		ttl: {
			totpSeconds: 1, // sec
			activateAccountSessionMinutes: 0.01, // in minutes -> 1 sec
			failedAuthAttemptsSessionMinutes: 0.01, // in minutes -> 1 sec
			authSessionMinutes: 0.01 // in minutes -> 1 sec
		},
		thresholds: {
			passwordBreach: 1,
			recaptcha: 2,
			maxFailedAuthAttempts: 3
		}
	});

	const defaultRegistrationInfo = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666'
	};

	const validAuthRequest: AuthenticationContext = {
		username: defaultRegistrationInfo.username,
		password: defaultRegistrationInfo.password,
		ip: '158.56.89.230',
		device: hostname(),
		location: {
			countryCode: 'US',
			regionCode: 'CA',
			city: 'Los Angeles',
			postalCode: '90067',
			timeZone: 'America/Los_Angeles',
			latitude: 34.0577507019043,
			longitude: -118.41380310058594
		}
	};

	it('registers a new account using explicit registration options', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true }); // do not trigger deletion timer
		const account = await basicAuthEngineConfig.entities.account.read('username');
		if (!account) {
			throw new Error('Registered account not found');
		}
		expect(account.id!).to.not.be.equal(undefined);
		expect(account.password).to.not.be.equal('auirg7q85y1298huwityh289');
		expect(account.password.length).to.be.equal(60);
		expect(account.salt).to.have.length(29);
		expect(account.telephone).to.be.eq('+568425666');
		expect(account.email).to.be.eq('user@product.com');
		expect(account.role).to.be.eq(undefined);
		expect(account.enabled).to.be.eq(true);
		expect(account.mfa).to.be.eq(true);
	});

	it('registers a new account with default registration options when they are not explicitly provided', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo); // activate default is false, it will trigger deletion timer
		const account = await basicAuthEngineConfig.entities.account.read('username');

		if (!account) {
			throw new Error('Registered account not found');
		}
		expect(account.enabled).to.be.eq(false);
		expect(account.mfa).to.be.eq(false);

		// @ts-ignore
		const activationToken = JSON.parse(basicAuthEngineConfig['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string);
		await AuthEngineInstance.activateAccount(activationToken.token); // this will cancel scheduleDeletion account timer
	});

	it('fails to register new account if it is registered already', async () => {
		// email ownership is checked via activation link -> OK
		// mobile ownership is not checked, but we assume that only account owner has onGet to his mobile number -> OK
		// check is made based on username, it needs to be unique, account activation status is not taken into account
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true }); // do not place scheduleDeletion timer
		try {
			await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
			assert(false, 'Same account was created twice');
		} catch (e) {
			expect(e).to.be.instanceOf(Exception).and.to.haveOwnProperty('emitter', Libraries.AUTH_ENGINE);
			expect(e).to.haveOwnProperty('code', ErrorCodes.ACCOUNT_ALREADY_REGISTERED);
			expect(e).to.haveOwnProperty('message', `Account ${defaultRegistrationInfo.username} is registered already.`);
		}
	});

	it('fails to register new account if provided password is weak (owasp validator)', () => {
		return AuthEngineInstance.register({ ...defaultRegistrationInfo, password: 'weak-password' })
			.then(() => assert(false, 'Account with weak password was registered'))
			.catch((e) => {
				expect(e).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.WEAK_PASSWORD);
				expect(e).to.haveOwnProperty(
					'message',
					'The password must contain at least one uppercase letter..\nThe password must contain at least one number.'
				);
			});
	});

	it('sends activation link via email if account is not considered activated at the registration', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		// @ts-ignore
		const activationToken = JSON.parse(basicAuthEngineConfig['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string);
		expect(activationToken.token.length).to.be.equal(basicAuthEngineConfig.tokensLength!);

		await AuthEngineInstance.activateAccount(activationToken.token); // this will cancel scheduleDeletion account timer
	});

	it('activates account using token sent via email at the registration', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		// @ts-ignore
		const activationToken = JSON.parse(basicAuthEngineConfig['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string);
		await AuthEngineInstance.activateAccount(activationToken.token);

		await chrono.sleep(1500); // wait for scheduleDeletion account scheduler timer to finish

		const account = await basicAuthEngineConfig.entities.account.read(defaultRegistrationInfo.username);
		if (!account) {
			throw new Error('Account not found. Delete account scheduling was not cancelled.');
		}
		expect(account.enabled).to.be.equal(true); // account was activated

		const activateAccountSession = await basicAuthEngineConfig.entities.activateAccountSession.read(activationToken.token);
		expect(activateAccountSession).to.be.eq(null); // activate account session was deleted
	});

	it('activate account will not fail if scheduleDeletion activate account session deletion will fail', async () => {
		// timer cancel is not allowed to throw, so operation can fail only if account status can't be changed to activated
		failureWillBeGeneratedForSessionOperation(SESSIONS_OP.ACTIVATE_ACCOUNT_SESSION_DELETE);

		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		// @ts-ignore
		const activationToken = JSON.parse(basicAuthEngineConfig['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string);
		await AuthEngineInstance.activateAccount(activationToken.token);

		const account = await basicAuthEngineConfig.entities.account.read(defaultRegistrationInfo.username);
		if (!account) {
			throw new Error('Account not found. Delete account scheduling was not cancelled.');
		}
		expect(account.enabled).to.be.equal(true); // account was activated

		const activateAccountSession = await basicAuthEngineConfig.entities.activateAccountSession.read(activationToken.token);
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
		const activationToken = JSON.parse(basicAuthEngineConfig['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string);
		await AuthEngineInstance.activateAccount(activationToken.token); // this will cancel scheduleDeletion account timer
	});

	it("doesn't activate account if canceling account deletion failed", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });

		failureWillBeGeneratedWhenScheduling(SCHEDULING_OP.CANCEL_DELETION_OF_UNACTIVATED_ACCOUNT);
		try {
			// @ts-ignore
			const activationToken = JSON.parse(basicAuthEngineConfig['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string);
			await AuthEngineInstance.activateAccount(activationToken.token);
		} catch (e) {
			expect(e).to.not.be.instanceOf(Exception);
			expect(e).to.haveOwnProperty('message', 'Canceling deletion of unactivated account was configured to fail');
			const authStatus = await AuthEngineInstance.authenticate(validAuthRequest);
			expect(authStatus.error!.hard).to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
			return;
		}
		assert(false, 'Account was activated, even if canceling account deletion failed.');
	});

	it('will scheduleDeletion account if not activated in specified amount of time (also deletes activate account session)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
		// @ts-ignore
		const activationToken = JSON.parse(basicAuthEngineConfig['side-channels'].email.client.outboxFor(defaultRegistrationInfo.email)[0].html as string);

		await chrono.sleep(1100); // wait timers to clean up resources

		const activateAccountSession = await basicAuthEngineConfig.entities.activateAccountSession.read(activationToken.token);
		expect(activateAccountSession).to.be.eq(null);
		const account = await basicAuthEngineConfig.entities.account.read(defaultRegistrationInfo.username);
		expect(account).to.be.eq(null);
	});

	it('will scheduleDeletion account if scheduling deletion of unactivated account failed', async () => {
		failureWillBeGeneratedWhenScheduling(SCHEDULING_OP.DELETE_UNACTIVATED_ACCOUNT);
		try {
			await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
			assert(false, 'Non-activated account was registered, even if scheduling deletion of unactivated account failed');
		} catch (e) {
			expect(e).to.be.instanceOf(Error, 'Scheduling scheduleDeletion unactivated account was configured to fail');
			const account = await basicAuthEngineConfig.entities.account.read(defaultRegistrationInfo.username);
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
			const account = await basicAuthEngineConfig.entities.account.read(defaultRegistrationInfo.username);
			expect(account).to.be.eq(null);
			expect(hasActiveTimers()).to.be.eq(false);
			expect(hasAnySessions()).to.be.eq(false);
		}
	});

	it('will scheduleDeletion account, activate session, cancel timers if activate link delivery via email failed', async () => {
		// @ts-ignore
		basicAuthEngineConfig['side-channels'].email.client.deliveryWillFail(true);
		try {
			await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });
			assert(false, 'Non-activated account was registered, even if delivery of activate link failed');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', EmailErrorCodes.EMAIL_DELIVERY_FAILED);
			expect(e).to.haveOwnProperty('message', 'Email client was configured to fail mail delivery');

			const account = await basicAuthEngineConfig.entities.account.read(defaultRegistrationInfo.username);
			expect(account).to.be.eq(null);
			expect(hasActiveTimers()).to.be.eq(false);
			expect(hasAnySessions()).to.be.eq(false);
		}
	});
});
