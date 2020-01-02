import { describe, it } from 'mocha';
import { assert, expect } from 'chai';
import Exception from '@marin/lib.error';
import { hostname } from 'os';
import { chrono, enums } from '@marin/lib.utils';
import { AuthenticationEngine } from '../lib/core';
import basicAuthengineConfig from './fixtures';
import { ErrorCodes } from '../lib/error';
import { AuthNetworkInput } from '../lib/types';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { AUTH_STEP } from '../lib/enums';
import { SmsMockInstance } from './fixtures/mocks/sms';

describe('Authenticate spec', () => {
	const AuthenticationEngineConfig = {
		...basicAuthengineConfig,
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
		await basicAuthengineConfig.entities.account.lock(accountId); // auth engine can't explicitly lock accounts
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
				.and.to.haveOwnProperty('code', ErrorCodes.CHECKING_FAILED);
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

	it("authenticates the user, registers active session, schedules it's deletion, deletes auth temp session (mfa not required)", async () => {
		// expected flow: dispatch -> secret -> authenticated

		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true, useMultiFactorAuth: false });
		const authStatus = await AuthEngineInstance.authenticate(validNetworkInput);

		// check issued valid jwt
		const jwtPayload = await basicAuthengineConfig.jwt.instance.validate(authStatus.token!);
		expect(jwtPayload.sub).to.be.eq(accountId);
		expect(jwtPayload.aud).to.be.eq(defaultRegistrationInfo.role);
		expect(jwtPayload.type).to.be.eq(enums.AUTH_TOKEN_TYPE.BASIC);

		// check it registered active session
		let activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);
		expect(activeSessions[0]).to.be.deep.eq({ id: jwtPayload.iat, accountId, ip: '158.56.89.230', device: hostname(), location: validNetworkInput.location });

		// check it deleted auth session
		const authSession = await basicAuthengineConfig.entities.authSession.read(validNetworkInput.username, validNetworkInput.device);
		expect(authSession).to.be.eq(null);

		// check if scheduled active session deletion
		await chrono.sleep(basicAuthengineConfig.jwt.rolesTtl.get(defaultRegistrationInfo.role)! * 1000);
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
		const jwtPayload = await basicAuthengineConfig.jwt.instance.validate(authStatusTotpStep.token!);
		expect(jwtPayload.sub).to.be.eq(accountId);
		expect(jwtPayload.aud).to.be.eq(defaultRegistrationInfo.role);
		expect(jwtPayload.type).to.be.eq(enums.AUTH_TOKEN_TYPE.BASIC);

		// check it registered active session
		let activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);
		expect(activeSessions[0]).to.be.deep.eq({ id: jwtPayload.iat, accountId, ip: '158.56.89.230', device: hostname(), location: validNetworkInput.location });

		// check it deleted auth session
		const authSession = await basicAuthengineConfig.entities.authSession.read(validNetworkInput.username, validNetworkInput.device);
		expect(authSession).to.be.eq(null);

		// check if scheduled active session deletion
		await chrono.sleep(basicAuthengineConfig.jwt.rolesTtl.get(defaultRegistrationInfo.role)! * 1000);
		activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(0);
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

		const authSession = await basicAuthengineConfig.entities.authSession.read(validNetworkInput.username, validNetworkInput.device);
		expect(authSession).to.be.eq(null);
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

	it('authenticated user after soft error occurred in totp multi factor auth step, expect failed auth session to be cleared', async () => {
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
});
