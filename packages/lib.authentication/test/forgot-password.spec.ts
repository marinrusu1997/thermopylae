/*
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { hostname } from 'os';
import Exception from '@marin/lib.error';
import { chrono, string } from '@marin/lib.utils';
import { AuthenticationEngine, ErrorCodes } from '../lib';
import AuthenticationEngineDefaultOptions from './fixtures';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { SIDE_CHANNEL } from '../lib/types/requests';
import { EmailMockInstance } from './fixtures/mocks/email';
import { SmsMockInstance } from './fixtures/mocks/sms';
import memcache, { failureWillBeGeneratedForSessionOperation, SESSIONS_OP } from './fixtures/memcache-entities';
import { checkIfJWTWasInvalidated, createAuthEnginesWithDifferentPasswordHashingAlg, validateSuccessfulLogin } from './utils';
import { AuthenticationStepName } from '../lib/types/enums';
import { ENTITIES_OP, failureWillBeGeneratedForEntityOperation } from './fixtures/mongo-entities';
import { AuthenticationContext } from '../lib/types/contexts';

describe('forgot password spec', () => {
	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineDefaultOptions);

	const defaultRegistrationInfo = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		role: ACCOUNT_ROLES.MODERATOR // needing increased duration of session
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

	it('recovers forgotten password via email side channel, removes session and logs out from all devices', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		// log in from some devices
		await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);
		await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);
		await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);
		expect((await AuthEngineInstance.getActiveSessions(accountId)).length).to.be.eq(3);

		await AuthEngineInstance.createForgotPasswordSession({ username: defaultRegistrationInfo.username, '2fa-channel': SIDE_CHANNEL.EMAIL });
		const forgotPasswordToken = JSON.parse(EmailMockInstance.outboxFor(defaultRegistrationInfo.email)[0].html as string).token;
		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword({ token: forgotPasswordToken, newPassword });

		// check forgot password session was deleted
		expect(await AuthenticationEngineDefaultOptions.repositories.forgotPasswordSession.read(forgotPasswordToken)).to.be.eq(null);

		// check logged out from all devices
		expect((await AuthEngineInstance.getActiveSessions(accountId)).length).to.be.eq(0);

		// check old password is no longer valid
		const oldCredentialsAuthStatus = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(oldCredentialsAuthStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(oldCredentialsAuthStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(oldCredentialsAuthStatus.token).to.be.eq(undefined);

		// check new credentials are valid
		await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, password: newPassword });
	});

	it('recovers forgotten password via sms side channel', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		await AuthEngineInstance.createForgotPasswordSession({ username: defaultRegistrationInfo.username, '2fa-channel': SIDE_CHANNEL.SMS });
		const forgotPasswordToken = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword({ token: forgotPasswordToken, newPassword });

		await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, password: newPassword });
	});

	it('recovers forgotten password via sms side channel after a new password hashing algorithm is used by the system', async () => {
		const [authEngineHashAlg1, authEngineHashAlg2] = createAuthEnginesWithDifferentPasswordHashingAlg(AuthenticationEngineDefaultOptions);

		// Register with AUTH ENGINE which uses HASHING ALG 1
		await authEngineHashAlg1.register(defaultRegistrationInfo, { enabled: true });

		// Change forgotten password with AUTH ENGINE which uses HASHING ALG 2
		await authEngineHashAlg2.createForgotPasswordSession({ username: defaultRegistrationInfo.username, '2fa-channel': SIDE_CHANNEL.SMS });
		const forgotPasswordToken = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		const newPassword = string.generateStringOfLength(30);
		await authEngineHashAlg2.changeForgottenPassword({ token: forgotPasswordToken, newPassword });

		// Login with AUTH ENGINE which uses HASHING ALG 1
		await validateSuccessfulLogin(authEngineHashAlg1, { ...validAuthRequest, password: newPassword });

		// Login with AUTH ENGINE which uses HASHING ALG 2
		await validateSuccessfulLogin(authEngineHashAlg2, { ...validAuthRequest, password: newPassword });
	});

	it('changes forgotten password if validation was ok, even if deletion of forgot password session might fail', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		await AuthEngineInstance.createForgotPasswordSession({ username: defaultRegistrationInfo.username, '2fa-channel': SIDE_CHANNEL.SMS });
		const forgotPasswordToken = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		const newPassword = 'asdD!45][#ddg85j';

		failureWillBeGeneratedForSessionOperation(SESSIONS_OP.FORGOT_PASSWORD_SESSION_DELETE);

		await AuthEngineInstance.changeForgottenPassword({ token: forgotPasswordToken, newPassword });

		await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, password: newPassword });
	});

	it('changes forgotten password if validation was ok, even if logout from all devices might fail', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		await AuthEngineInstance.createForgotPasswordSession({ username: defaultRegistrationInfo.username, '2fa-channel': SIDE_CHANNEL.SMS });
		const forgotPasswordToken = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		const newPassword = 'asdD!45][#ddg85j';

		failureWillBeGeneratedForEntityOperation(ENTITIES_OP.ACTIVE_USER_SESSION_DELETE_ALL);

		await AuthEngineInstance.changeForgottenPassword({ token: forgotPasswordToken, newPassword });

		await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, password: newPassword });
	});

	it('prevents user enumeration by responding positive on invalid username', async () => {
		await AuthEngineInstance.createForgotPasswordSession({ username: 'non-existing', '2fa-channel': SIDE_CHANNEL.SMS });
		expect(SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0]).to.be.eq(undefined);
		expect(EmailMockInstance.outboxFor(defaultRegistrationInfo.email)[0]).to.be.eq(undefined);
	});

	it("doesn't create forgot password session if account is disabled", async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: false });

		let err;
		try {
			await AuthEngineInstance.createForgotPasswordSession({
				username: defaultRegistrationInfo.username,
				'2fa-channel': SIDE_CHANNEL.EMAIL
			});
		} catch (e) {
			err = e;
		}

		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(err).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
	});

	it('aborts the create forgot password session if token delivery fails', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		EmailMockInstance.deliveryWillFail(true);
		let err;
		try {
			await AuthEngineInstance.createForgotPasswordSession({
				username: defaultRegistrationInfo.username,
				'2fa-channel': SIDE_CHANNEL.EMAIL
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.haveOwnProperty('message', 'Email client was configured to fail mail delivery');
		expect(memcache.keys().length).to.be.eq(0); // session was deleted

		SmsMockInstance.deliveryWillFail(true);
		try {
			await AuthEngineInstance.createForgotPasswordSession({
				username: defaultRegistrationInfo.username,
				'2fa-channel': SIDE_CHANNEL.SMS
			});
		} catch (e) {
			err = e;
		}
		expect(err).to.haveOwnProperty('message', 'SMS mock client was configured to fail sms delivery');
		expect(memcache.keys().length).to.be.eq(0); // session was deleted
	});

	it('fails to create forgot password session when providing unknown side channel for token delivery', async () => {
		let unknownSideChannelErr;

		const sideChannel = string.generateStringOfLength(10);
		try {
			await AuthEngineInstance.createForgotPasswordSession({
				username: 'does not matter',
				// @ts-ignore, for testing purposes
				'2fa-channel': sideChannel
			});
		} catch (e) {
			unknownSideChannelErr = e;
		}

		expect(unknownSideChannelErr).to.be.instanceOf(Exception);
		expect(unknownSideChannelErr).to.haveOwnProperty('code', ErrorCodes.UNKNOWN_SIDE_CHANNEL);

		const errMsg = `Side-Channel ${sideChannel} is UNKNOWN. Allowed side-channels are: ${[SIDE_CHANNEL.EMAIL, SIDE_CHANNEL.SMS].join(', ')}`;
		expect(unknownSideChannelErr).to.haveOwnProperty('message', errMsg);
	});

	it('fails to change forgotten password when providing invalid token', async () => {
		let err;
		try {
			await AuthEngineInstance.changeForgottenPassword({ token: 'invalid', newPassword: 'does not matter' });
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.SESSION_NOT_FOUND);
		expect(err).to.haveOwnProperty('message', `Forgot password session identified by provided token invalid not found. `);
	});

	it('fails to change forgotten password when providing new weak password', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		await AuthEngineInstance.createForgotPasswordSession({ username: defaultRegistrationInfo.username, '2fa-channel': SIDE_CHANNEL.SMS });
		const forgotPasswordToken = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];

		let err;
		try {
			await AuthEngineInstance.changeForgottenPassword({ token: forgotPasswordToken, newPassword: 'weak' });
		} catch (e) {
			err = e;
		}
		expect(err).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.WEAK_PASSWORD);
		expect(err).to.haveOwnProperty(
			'message',
			'The password must be at least 10 characters long..\nThe password must contain at least one uppercase letter..\nThe password must contain at least one number..\nThe password must contain at least one special character.'
		);
	});

	it('recovers forged account by using forgot password functionality', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		// valid user authenticated
		const firstAccountOwnerAuthStatus = await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);

		await chrono.sleep(1000);

		// bad guy logged into user account using his credentials
		const forgedAuthStatus = await AuthEngineInstance.authenticate(validAuthRequest);
		const forgedActiveSessions = await AuthEngineInstance.getActiveSessions(accountId);
		const forgedNewPassword = '22kk~!Mahfiiffd2';
		expect(
			await AuthEngineInstance.changePassword({
				accountId,
				sessionId: forgedActiveSessions[1].authenticatedAtUNIX, // invalidate all, except the last one
				oldPassword: defaultRegistrationInfo.password,
				newPassword: forgedNewPassword
			})
		).to.be.eq(1); // invalidated first session of the user

		// user session was invalidated after password change
		await checkIfJWTWasInvalidated(firstAccountOwnerAuthStatus.token!, AuthenticationEngineDefaultOptions.jwt.instance);

		// user tries to recover account using forgot password procedure
		await AuthEngineInstance.createForgotPasswordSession({ username: defaultRegistrationInfo.username, '2fa-channel': SIDE_CHANNEL.SMS });
		const forgotPasswordToken = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		const newPassword = 'asdD!45][#ddg85j';
		await AuthEngineInstance.changeForgottenPassword({ token: forgotPasswordToken, newPassword });

		// after recovering his account password, session of the bad guy is invalidated
		await checkIfJWTWasInvalidated(forgedAuthStatus.token!, AuthenticationEngineDefaultOptions.jwt.instance);

		// valid user can authenticate with his new password
		await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, password: newPassword });

		// bad guy can't log with old credentials
		const oldCredentialsAuthStatus = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(oldCredentialsAuthStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
	});
});
*/
