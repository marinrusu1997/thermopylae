import { describe, it } from 'mocha';
import { assert, expect } from 'chai';
import Exception from '@marin/lib.error';
import { hostname } from 'os';
import { chrono, enums } from '@marin/lib.utils';
import { AuthenticationEngine } from '../lib/core';
import { ErrorCodes } from '../lib/error';
import { AuthNetworkInput } from '../lib/types';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { AUTH_STEP } from '../lib/enums';
import { SmsMockInstance } from './fixtures/mocks/sms';
import basicAuthEngineConfig from './fixtures';

describe('Authenticate spec', () => {
	const AuthenticationEngineConfig = {
		...basicAuthEngineConfig,
		ttl: {
			totp: 1, // second,
			authSession: 0.01 // minute
		},
		thresholds: {
			passwordBreach: 1,
			recaptcha: 2,
			maxFailedAuthAttempts: 3
		}
	};

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineConfig);

	const defaultRegistrationInfo = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		role: ACCOUNT_ROLES.USER
	};

	const validNetworkInput: AuthNetworkInput = {
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

	it('fails to authenticate non existing accounts', () => {
		const networkInput = { username: 'non-existing-account' };
		// @ts-ignore
		return AuthEngineInstance.authenticate(networkInput)
			.then(() => assert(false, 'User with non existing account was authenticated'))
			.catch((e: Error | Exception) => {
				if (!(e instanceof Exception)) {
					throw e;
				}
				expect(e)
					.to.be.instanceOf(Exception)
					.and.to.haveOwnProperty('code', ErrorCodes.NOT_FOUND);
				expect(e).to.haveOwnProperty('message', `Account ${networkInput.username} not found.`);
			});
	});

	it('fails to authenticate users with locked accounts', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		await basicAuthEngineConfig.entities.account.lock(accountId); // auth engine can't explicitly lock accounts
		const networkInput = { username: defaultRegistrationInfo.username };
		try {
			// @ts-ignore
			await AuthEngineInstance.authenticate(networkInput);
			assert(false, 'User with a locked account was authenticated');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_IS_LOCKED);
			expect(e).to.haveOwnProperty('message', `Account ${networkInput.username} is locked.`);
		}
	});

	it('fails to authenticate users with non activated accounts', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo); // by default, account is not activated
		const networkInput = { username: defaultRegistrationInfo.username };
		try {
			// @ts-ignore
			await AuthEngineInstance.authenticate(networkInput);
			assert(false, 'User with a non activated account was authenticated');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.CHECKING_FAILED);
			expect(e).to.haveOwnProperty('message', `Account ${networkInput.username} is not activated.`);
			// automatic clean up, for timers too
		}
	});

	it('fails to authenticate user when wrong secret provided, user gives up, expect not to leak disk memory for auth temp session', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		const authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });

		expect(authStatus.nextStep).to.be.eq(AUTH_STEP.SECRET);
		expect(authStatus.error!.soft)
			.to.be.instanceOf(Exception)
			.and.to.have.property('code', ErrorCodes.INVALID_ARGUMENT);

		const authSessionTTLMs = chrono.minutesToSeconds(AuthenticationEngineConfig.ttl.authSession) * 1000 + 50; // 1050 ms
		await chrono.sleep(authSessionTTLMs);

		const authSession = await basicAuthEngineConfig.entities.authSession.read(validNetworkInput.username, validNetworkInput.device);
		expect(authSession).to.be.eq(null);
	});

	it("doesn't allow to bypass multi factor step, if not providing totp token", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: true });
		let authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput });
		const firstTOTP = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		expect(authStatus.nextStep).to.be.eq(AUTH_STEP.TOTP);
		expect(firstTOTP).to.not.be.eq(undefined);

		SmsMockInstance.clearOutboxFor(defaultRegistrationInfo.telephone);
		await chrono.sleep(1000); // totp is based on timestamps, need another timestamp in order to issue different token

		// subsequent calls should resolve to totp step
		authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput });
		const [secondTOTP] = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone);
		expect(authStatus.nextStep).to.be.eq(AUTH_STEP.TOTP);
		expect(secondTOTP).to.not.be.eq(undefined);

		expect(firstTOTP).to.not.be.eq(secondTOTP);
	});

	it("can't use same totp twice (prevents replay attacks)", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: true });
		let authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput });
		const totp = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];

		authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, totp });
		expect(authStatus.token).to.not.be.eq(undefined); // this will remove token from auth session, thus in can't be used twice

		authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, totp });
		expect(authStatus.error!.soft)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.INVALID_ARGUMENT);
		expect(authStatus.nextStep).to.be.eq(AUTH_STEP.SECRET);
	});

	it('failed auth attempts are shared between auth sessions', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		const DEVICE1 = 'device1';
		const DEVICE2 = 'device2';
		const DEVICE3 = 'device3';
		let numberOfAuthAttempts = 0;

		// increase failure counter from one session till recaptcha
		let recaptchaThreshold = AuthenticationEngineConfig.thresholds.recaptcha - 1;
		// eslint-disable-next-line no-plusplus
		while (recaptchaThreshold--) {
			const status = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: DEVICE1, password: 'invalid' });
			expect(status.error!.soft)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.INVALID_ARGUMENT);
			expect(status.nextStep).to.be.eq(AUTH_STEP.SECRET);
			numberOfAuthAttempts += 1;
		}

		// from another session increase till account lock
		let numberOfTriesTillAccountLock = AuthenticationEngineConfig.thresholds.maxFailedAuthAttempts - AuthenticationEngineConfig.thresholds.recaptcha;
		// eslint-disable-next-line no-plusplus
		while (numberOfTriesTillAccountLock--) {
			const status = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: DEVICE2, password: 'invalid' });
			expect(status.error!.soft)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.INVALID_ARGUMENT);
			expect(status.nextStep).to.be.eq(AUTH_STEP.RECAPTCHA);
			numberOfAuthAttempts += 1;
		}

		expect(numberOfAuthAttempts).to.be.eq(AuthenticationEngineConfig.thresholds.recaptcha);

		const status = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: DEVICE3, password: 'invalid' });
		expect(status.error!.hard)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_IS_LOCKED);
	});

	it("authenticates the user, registers active session, schedules it's deletion, deletes auth temp session (mfa not required)", async () => {
		// expected flow: dispatch -> secret -> authenticated

		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: false });
		const authStatus = await AuthEngineInstance.authenticate(validNetworkInput);

		// check issued valid jwt
		const jwtPayload = await basicAuthEngineConfig.jwt.instance.validate(authStatus.token!);
		expect(jwtPayload.sub).to.be.eq(accountId);
		expect(jwtPayload.aud).to.be.eq(defaultRegistrationInfo.role);
		expect(jwtPayload.type).to.be.eq(enums.AUTH_TOKEN_TYPE.BASIC);

		// check it registered active session
		let activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);
		expect(activeSessions[0]).to.be.deep.eq({ timestamp: jwtPayload.iat, accountId, ip: '158.56.89.230', device: hostname(), location: validNetworkInput.location });

		// check it deleted auth session
		const authSession = await basicAuthEngineConfig.entities.authSession.read(validNetworkInput.username, validNetworkInput.device);
		expect(authSession).to.be.eq(null);

		// check if scheduled active session deletion
		await chrono.sleep(basicAuthEngineConfig.jwt.rolesTtl.get(defaultRegistrationInfo.role)! * 1000);
		activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(0);
	});

	it("authenticates the user, registers active session, schedules it's deletion, deletes auth temp session (mfa is required)", async () => {
		// expected flow: dispatch -> secret -> generate totp => dispatch -> totp -> authenticated

		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		await AuthEngineInstance.requireMultiFactorAuth(accountId, true);

		const authStatusSecretStep = await AuthEngineInstance.authenticate(validNetworkInput);
		expect(authStatusSecretStep.nextStep!).to.be.eq(AUTH_STEP.TOTP);

		const totp = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		const authStatusTotpStep = await AuthEngineInstance.authenticate({ ...validNetworkInput, totp });

		// check issued valid jwt
		const jwtPayload = await basicAuthEngineConfig.jwt.instance.validate(authStatusTotpStep.token!);
		expect(jwtPayload.sub).to.be.eq(accountId);
		expect(jwtPayload.aud).to.be.eq(defaultRegistrationInfo.role);
		expect(jwtPayload.type).to.be.eq(enums.AUTH_TOKEN_TYPE.BASIC);

		// check it registered active session
		let activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);
		expect(activeSessions[0]).to.be.deep.eq({ timestamp: jwtPayload.iat, accountId, ip: '158.56.89.230', device: hostname(), location: validNetworkInput.location });

		// check it deleted auth session
		const authSession = await basicAuthEngineConfig.entities.authSession.read(validNetworkInput.username, validNetworkInput.device);
		expect(authSession).to.be.eq(null);

		// check if scheduled active session deletion
		await chrono.sleep(basicAuthEngineConfig.jwt.rolesTtl.get(defaultRegistrationInfo.role)! * 1000);
		activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(0);
	});

	it('authenticates user after soft error occurred in secret step, expect failed auth session to be cleared', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });
		await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });

		// second time will work, also needs to reset failed auth attempts
		let authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput });
		expect(authStatus.token).to.not.be.eq(undefined);

		// now retry again till hard error, counter needs to be 0 again
		let maxAllowedFailedAuthAttempts = AuthenticationEngineConfig.thresholds.maxFailedAuthAttempts - 1; // on last it will lock account
		// eslint-disable-next-line no-plusplus
		while (maxAllowedFailedAuthAttempts--) {
			authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
			expect(authStatus.error!.soft).to.not.be.eq(undefined);
			expect(authStatus.error!.hard).to.be.eq(undefined);
		}

		const failedAuthAttemptsSession = await AuthenticationEngineConfig.entities.failedAuthAttemptsSession.read(defaultRegistrationInfo.username);
		expect(failedAuthAttemptsSession!.counter).to.be.eq(2);
	});

	it('authenticates user after soft error occurred in totp multi factor auth step, expect failed auth session to be cleared', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: true });
		let authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput });
		const totp = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];

		authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, totp: 'invalid' });
		expect(authStatus.nextStep).to.be.eq(AUTH_STEP.SECRET);
		expect(authStatus.error!.soft).to.not.be.eq(undefined);

		// second time will work, also needs to reset failed auth attempts
		authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, totp });
		expect(authStatus.token).to.not.be.eq(undefined);

		// now retry again till hard error, counter needs to be 0 again
		let maxAllowedFailedAuthAttempts = AuthenticationEngineConfig.thresholds.maxFailedAuthAttempts - 1; // on last it will lock account
		// eslint-disable-next-line no-plusplus
		while (maxAllowedFailedAuthAttempts--) {
			authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
			expect(authStatus.error!.soft).to.not.be.eq(undefined);
			expect(authStatus.error!.hard).to.be.eq(undefined);
		}

		const failedAuthAttemptsSession = await AuthenticationEngineConfig.entities.failedAuthAttemptsSession.read(defaultRegistrationInfo.username);
		expect(failedAuthAttemptsSession!.counter).to.be.eq(2);
	});

	it('authenticates after soft errors occurred in secret step and recaptcha was activated (multi factor auth not required)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		async function authenticateAfterSoftErrorInRecaptchaStep() {
			let recaptchaThreshold = AuthenticationEngineConfig.thresholds.recaptcha;
			// eslint-disable-next-line no-plusplus
			while (recaptchaThreshold--) {
				await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
			}

			// now provide correct info along with correct recaptcha
			const authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, recaptcha: 'valid' }); // this is how validator is implemented
			expect(authStatus.token).to.not.be.eq(undefined);
		}

		// try first time
		await authenticateAfterSoftErrorInRecaptchaStep();

		// try second time, should work, as auth session along with failed auth attempts sessions were destroyed
		await authenticateAfterSoftErrorInRecaptchaStep();
	});

	it('authenticates after soft errors occurred in secret step and recaptcha was activated (multi factor auth required)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: true });

		// trigger recaptcha
		let recaptchaThreshold = AuthenticationEngineConfig.thresholds.recaptcha;
		// eslint-disable-next-line no-plusplus
		while (recaptchaThreshold--) {
			await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
		}

		// provide valid recaptcha
		let authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, recaptcha: 'valid' });
		expect(authStatus.nextStep).to.be.eq(AUTH_STEP.TOTP);

		const [totp] = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone);
		authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, totp });
		expect(authStatus.token).to.not.be.eq(undefined);
	});

	it('aborts authentication after hard error occurred in secret step (recaptcha and mfa not required)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		let lastAuthStatus: any;
		for (let i = 0; i < AuthenticationEngineConfig.thresholds.maxFailedAuthAttempts; i++) {
			lastAuthStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
		}

		expect(lastAuthStatus!.error!.hard)
			.to.be.instanceOf(Exception)
			.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_IS_LOCKED);

		try {
			await AuthEngineInstance.authenticate({ ...validNetworkInput });
			assert(false, 'Authentication with valid credentials was possible, even when account was locked');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_IS_LOCKED);
		}
	});

	it('aborts authentication after hard error occurred in recaptcha step (mfa not required)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds.recaptcha; i++) {
			await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
		}

		for (let i = AuthenticationEngineConfig.thresholds.recaptcha; i < AuthenticationEngineConfig.thresholds.maxFailedAuthAttempts; i++) {
			await AuthEngineInstance.authenticate({ ...validNetworkInput, recaptcha: 'invalid' });
		}

		try {
			await AuthEngineInstance.authenticate({ ...validNetworkInput });
			assert(false, 'Authentication with valid credentials was possible, even when account was locked');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_IS_LOCKED);
		}
	});

	it('aborts authentication after hard error occurred in mfa step (recaptcha required)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds.recaptcha; i++) {
			await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
		}

		const recaptchaAuthStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, recaptcha: 'valid' });
		expect(recaptchaAuthStatus.nextStep).to.be.eq(AUTH_STEP.TOTP);
		expect(SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0]).to.not.be.eq(undefined);

		for (let i = AuthenticationEngineConfig.thresholds.recaptcha; i < AuthenticationEngineConfig.thresholds.maxFailedAuthAttempts; i++) {
			await AuthEngineInstance.authenticate({ ...validNetworkInput, totp: 'invalid' });
		}

		try {
			await AuthEngineInstance.authenticate({ ...validNetworkInput });
			assert(false, 'Authentication with valid credentials was possible, even when account was locked');
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e)
				.to.be.instanceOf(Exception)
				.and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_IS_LOCKED);
		}
	});

	it('stores failed auth attempts after account was locked when failure threshold reached', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds.maxFailedAuthAttempts; i++) {
			await AuthEngineInstance.authenticate({ ...validNetworkInput, password: 'invalid' });
		}

		const failedAuthAttempts = await AuthEngineInstance.getFailedAuthAttempts(accountId);
		expect(failedAuthAttempts.length).to.be.eq(1);
		expect(failedAuthAttempts[0].devices.size).to.be.eq(1);
		expect(failedAuthAttempts[0].ips.size).to.be.eq(1);

		expect(failedAuthAttempts[0].devices.has(validNetworkInput.device)).to.be.eq(true);
		expect(failedAuthAttempts[0].ips.has(validNetworkInput.ip)).to.be.eq(true);
	});
});
