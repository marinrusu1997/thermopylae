import { describe, it } from 'mocha';
import { expect, assert, AssertionError } from 'chai';
import { hostname } from 'os';
import { chrono } from '@marin/lib.utils';
import basicAuthEngineConfig from './fixtures';
import { AuthenticationEngine } from '../lib/core';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { AuthNetworkInput } from '../lib/types';

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

	async function checkIfJWTWasInvalidated(token: string): Promise<void> {
		let jwtValidateError;
		try {
			await AuthenticationEngineConfig.jwt.instance.validate(token);
			assert(false, 'Authorization was made, even if token needed to be invalidated!');
		} catch (e) {
			if (e instanceof AssertionError) {
				throw e;
			}
			jwtValidateError = e;
		}
		expect(jwtValidateError).to.not.be.eq(undefined);
	}

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

		await checkIfJWTWasInvalidated(authStatusFirstDevice.token!);
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

		await checkIfJWTWasInvalidated(authStatus.token!);
	});
});
