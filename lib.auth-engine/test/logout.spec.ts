import { describe, it } from 'mocha';
import { expect } from 'chai';
import { hostname } from 'os';
import { chrono } from '@marin/lib.utils';
import basicAuthEngineConfig from './fixtures';
import { AuthenticationEngine } from '../lib/core';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { AuthInput } from '../lib/types';
import { checkIfJWTWasInvalidated } from './utils';

describe('Logout spec', () => {
	const AuthenticationEngineConfig = {
		...basicAuthEngineConfig,
		ttl: {
			totp: 1, // second,
			authSession: 0.01 // in minutes, equals 1 second
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
		role: ACCOUNT_ROLES.MODERATOR // needed increased jwt duration
	};

	const validNetworkInput: AuthInput = {
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

	it('logs out from one device, expecting to delete existing session and invalidate token', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		const authStatusFirstDevice = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device1' });
		await chrono.sleep(1000);
		await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device2' });

		let activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(2);

		await AuthEngineInstance.logout(await AuthenticationEngineConfig.jwt.instance.validate(authStatusFirstDevice.token!));
		activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);

		expect(activeSessions[0].device).to.be.eq('device2');

		await checkIfJWTWasInvalidated(authStatusFirstDevice.token!, basicAuthEngineConfig.jwt.instance);
	});

	it('logs out from all devices, expecting to delete all existing sessions and invalidate issued tokens', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		const authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device1' });
		await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device1' });
		await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device2' });
		await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device3' });

		const activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(4);

		const deletedSessions = await AuthEngineInstance.logoutFromAllDevices({ sub: accountId, aud: defaultRegistrationInfo.role });
		expect(deletedSessions).to.be.eq(activeSessions.length);

		await checkIfJWTWasInvalidated(authStatus.token!, basicAuthEngineConfig.jwt.instance);
	});

	it('logs out from all devices, except from the connected one from where logout was requested', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		const authStatus1 = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device1' });
		await chrono.sleep(1000);
		const authStatus2 = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device2' });
		await chrono.sleep(1000);
		const authStatus3 = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device3' });

		const activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(3);

		const deletedSessions = await AuthEngineInstance.logoutFromAllDevicesExceptFrom(accountId, activeSessions[0].timestamp);
		expect(deletedSessions).to.be.eq(activeSessions.length - 1);

		expect(await basicAuthEngineConfig.jwt.instance.validate(authStatus1.token!)).to.not.be.eq(undefined);
		await checkIfJWTWasInvalidated(authStatus2.token!, basicAuthEngineConfig.jwt.instance);
		await checkIfJWTWasInvalidated(authStatus3.token!, basicAuthEngineConfig.jwt.instance);
	}).timeout(3000);

	it('logs out from no devices, except one, when there is only 1 session', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { isActivated: true });

		const authStatus = await AuthEngineInstance.authenticate({ ...validNetworkInput, device: 'device1' });

		const activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);

		const deletedSessions = await AuthEngineInstance.logoutFromAllDevicesExceptFrom(accountId, activeSessions[0].timestamp);
		expect(deletedSessions).to.be.eq(0);

		expect(await basicAuthEngineConfig.jwt.instance.validate(authStatus.token!)).to.not.be.eq(undefined);
	});
});
