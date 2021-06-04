import { describe, it } from 'mocha';
import { expect } from 'chai';
import Exception from '@marin/lib.error';
import { hostname } from 'os';
import { createSign, HexBase64Latin1Encoding } from 'crypto';
import { chrono, number, string } from '@marin/lib.utils';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { AuthTokenType } from '@marin/lib.utils/dist/declarations';
// @ts-ignore
import keypair from 'keypair';
import { AuthenticationEngineOptions, AuthenticationEngine, ErrorCodes } from '../lib';
import { ACCOUNT_ROLES } from './fixtures/jwt';
import { AuthenticationStepName } from '../lib/types/enums';
import { SmsMockInstance } from './fixtures/mocks/sms';
import basicAuthEngineConfig from './fixtures';
import { ENTITIES_OP, failureWillBeGeneratedForEntityOperation } from './fixtures/mongo-entities';
import { failureWillBeGeneratedForSessionOperation, SESSIONS_OP } from './fixtures/memcache-entities';
import { EmailMockInstance } from './fixtures/mocks/email';
import { failureWillBeGeneratedWhenScheduling, hasActiveTimers, SCHEDULING_OP } from './fixtures/schedulers';
import { createAuthEnginesWithDifferentPasswordHashingAlg, validateSuccessfulLogin } from './utils';
import { AuthenticationContext } from '../lib/types/contexts';

describe('Authenticate spec', () => {
	const primaryKeyPair = keypair();
	const secondaryKeyPair = keypair();

	const AuthenticationEngineConfig: AuthenticationEngineOptions = {
		...basicAuthEngineConfig,
		ttl: {
			totpSeconds: 1,
			authenticationSession: 0.01 // 1 second
		},
		thresholds: {
			passwordSimilarity: 1,
			failedAuthAttemptsRecaptcha: 2,
			maxFailedAuthAttempts: 3,
			enableAccountAfterAuthFailureDelayMinutes: 0.03 // 3 seconds
		}
	};

	const AuthEngineInstance = new AuthenticationEngine(AuthenticationEngineConfig);

	const defaultRegistrationInfo = {
		username: 'username',
		password: 'auirg7q85y1298huwityh289',
		email: 'user@product.com',
		telephone: '+568425666',
		role: ACCOUNT_ROLES.USER,
		pubKey: primaryKeyPair.public
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

	function signChallengeNonce(nonce: string, privateKey?: string): string {
		return createSign('RSA-SHA512')
			.update(nonce)
			.sign(privateKey || primaryKeyPair.private, 'base64');
	}

	it('fails to authenticate non existing accounts', () => {
		const networkInput = { username: 'non-existing-account' };
		// @ts-ignore
		return AuthEngineInstance.authenticate(networkInput).then((authStatus) => {
			expect(authStatus.token).to.be.eq(undefined);
			expect(authStatus.nextStep).to.be.eq(undefined);
			expect(authStatus.error!.soft).to.be.eq(undefined);
			expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_NOT_FOUND);
			expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account ${networkInput.username} not found. `);
		});
	});

	it('fails to authenticate users with disabled accounts', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		await AuthEngineInstance.disableAccount(accountId, 'For test');
		const networkInput = { username: defaultRegistrationInfo.username };
		// @ts-ignore
		return AuthEngineInstance.authenticate(networkInput).then((authStatus) => {
			expect(authStatus.token).to.be.eq(undefined);
			expect(authStatus.nextStep).to.be.eq(undefined);
			expect(authStatus.error!.soft).to.be.eq(undefined);
			expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
			expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
		});
	});

	it('fails to authenticate user when wrong secret provided, user gives up, expect not to leak disk memory for auth temp session', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });

		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.have.property('code', ErrorCodes.INCORRECT_CREDENTIALS);

		const authSessionTTLMs = chrono.minutesToSeconds(AuthenticationEngineConfig.ttl!.authenticationSession!) * 1000 + 50; // 1050 ms
		await chrono.sleep(authSessionTTLMs);

		const authSession = await basicAuthEngineConfig.repositories.authenticationSession.read(validAuthRequest.username, validAuthRequest.device);
		expect(authSession).to.be.eq(null);
	});

	it('fails to authenticate user when challenge response nonce not found in session (i.e. never generated or generated but deleted)', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo);
		await AuthEngineInstance.enableAccount(accountId);

		const signatureOfTokenWhichWasNeverIssued = signChallengeNonce('token-which-was-never-issued');
		let authStatus = await AuthEngineInstance.authenticate({
			...validAuthRequest,
			responseForChallenge: { signature: signatureOfTokenWhichWasNeverIssued, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);

		authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		const signatureOfValidToken = signChallengeNonce(authStatus.token!);
		await validateSuccessfulLogin(AuthEngineInstance, {
			...validAuthRequest,
			responseForChallenge: { signature: signatureOfValidToken, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});

		// prevent replay attack
		authStatus = await AuthEngineInstance.authenticate({
			...validAuthRequest,
			responseForChallenge: { signature: signatureOfValidToken, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
	});

	it('fails to authenticate user when challenge nonce is signed with invalid private key', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		let authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		const signature = signChallengeNonce(authStatus.token!, secondaryKeyPair.private);
		authStatus = await AuthEngineInstance.authenticate({
			...validAuthRequest,
			responseForChallenge: { signature, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
	});

	it('fails to authenticate user when invalid challenge nonce is signed with valid private key (unlikely to happen in real scenario)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		let authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		const signature = signChallengeNonce('invalid token');
		authStatus = await AuthEngineInstance.authenticate({
			...validAuthRequest,
			responseForChallenge: { signature, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
		});
		expect(authStatus.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
	});

	it('returns soft error when totp was not valid, regardless of whether `notify via email about failed mfa` might fail or not', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

		let authStatus = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.error).to.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone).length).to.be.eq(1);

		EmailMockInstance.deliveryWillFail();

		authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, totp: "some garbage, we don't care" });

		expect(EmailMockInstance.outboxFor(defaultRegistrationInfo.email).length).to.be.eq(0);
		expect(SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone).length).to.be.eq(1); // new totp was not generated

		expect(authStatus.token).to.be.eq(undefined);

		expect(authStatus.error!.soft).to.be.instanceOf(Exception);
		expect(authStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.error!.soft).to.haveOwnProperty(
			'message',
			`Credentials are not valid. Remaining attempts (${AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts! - 1}). `
		);

		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
	});

	it('completes authentication successfully, regardless of whether `notify authentication from different device` might fail or not', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);

		EmailMockInstance.deliveryWillFail();

		await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, device: string.generateStringOfLength(10) });

		expect(EmailMockInstance.outboxFor(defaultRegistrationInfo.email).length).to.be.eq(0);
		expect(SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone).length).to.be.eq(0);
	});

	it("doesn't allow to bypass multi factor step, if not providing totp token", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });
		let authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		const firstTOTP = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(firstTOTP).to.not.be.eq(undefined);

		SmsMockInstance.clearOutboxFor(defaultRegistrationInfo.telephone);
		await chrono.sleep(1000); // totp is based on timestamps, need another authenticatedAt in order to issue different token

		// subsequent calls should resolve to totp step
		authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		const [secondTOTP] = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(secondTOTP).to.not.be.eq(undefined);

		expect(firstTOTP).to.not.be.eq(secondTOTP);
	});

	it("can't use same totp twice (prevents replay attacks)", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });
		let authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		const totp = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];

		// this will remove token from auth session, thus in can't be used twice
		authStatus = await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, totp });

		authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, totp });
		expect(authStatus.error!.soft).to.be.instanceOf(Exception);
		expect(authStatus.error!.soft).to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
	});

	it("doesn't allow authentication when recaptcha is required, but not provided, furthermore it can disable account on threshold", async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

		// activate recaptcha
		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		// provide no recaptcha when it's required
		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, recaptcha: undefined });
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('failed auth attempts are shared between auth sessions', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		const DEVICE1 = 'device1';
		const DEVICE2 = 'device2';
		const DEVICE3 = 'device3';
		let numberOfAuthAttempts = 0;

		// increase failure counter from one session till recaptcha
		let recaptchaThreshold = AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha! - 1;
		// eslint-disable-next-line no-plusplus
		while (recaptchaThreshold--) {
			const status = await AuthEngineInstance.authenticate({ ...validAuthRequest, device: DEVICE1, password: 'invalid' });
			expect(status.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.INCORRECT_CREDENTIALS);
			expect(status.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
			numberOfAuthAttempts += 1;
		}

		// from another session increase till account is disabled
		let numberOfTriesTillAccountLock =
			AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts! - AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!;
		// eslint-disable-next-line no-plusplus
		while (numberOfTriesTillAccountLock--) {
			const status = await AuthEngineInstance.authenticate({ ...validAuthRequest, device: DEVICE2, password: 'invalid' });
			expect(status.error!.soft).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.RECAPTCHA_THRESHOLD_REACHED);
			expect(status.nextStep).to.be.eq(AuthenticationStepName.RECAPTCHA);
			numberOfAuthAttempts += 1;
		}

		expect(numberOfAuthAttempts).to.be.eq(AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha);

		const status = await AuthEngineInstance.authenticate({ ...validAuthRequest, device: DEVICE3, password: 'invalid' });
		expect(status.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('disables account on failed auth attempts threshold, even if sending notification email and logging user out from all devices failed', async () => {
		EmailMockInstance.deliveryWillFail(true);
		failureWillBeGeneratedForEntityOperation(ENTITIES_OP.ACTIVE_USER_SESSION_DELETE_ALL);

		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.eq(undefined);
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
	});

	it('disables the user account when providing invalid response to challenge', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		for (let i = 1; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, generateChallenge: true });
			const authStatus = await AuthEngineInstance.authenticate({
				...validAuthRequest,
				responseForChallenge: { signature: 'invalid signature', signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' }
			});
			expect(authStatus.error!.soft).to.be.instanceOf(Exception);
			expect(authStatus.error!.soft!.code).to.be.oneOf([ErrorCodes.INCORRECT_CREDENTIALS, ErrorCodes.RECAPTCHA_THRESHOLD_REACHED]);
			expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		}

		try {
			await AuthEngineInstance.authenticate({ ...validAuthRequest }); // using secret step
		} catch (e) {
			if (!(e instanceof Exception)) {
				throw e;
			}
			expect(e).to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		}
	});

	it("authenticates the user, registers active session, schedules it's deletion, deletes auth temp session (mfa disabled)", async () => {
		// expected flow: dispatch -> secret -> authenticated

		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo);
		await AuthEngineInstance.enableAccount(accountId);
		await AuthEngineInstance.disableMultiFactorAuthentication(accountId);
		const authStatus = await AuthEngineInstance.authenticate(validAuthRequest);

		// check issued valid jwt
		const jwtPayload = await basicAuthEngineConfig.jwt.instance.validate(authStatus.token!);
		expect(jwtPayload.sub).to.be.eq(accountId);
		expect(jwtPayload.aud).to.be.eq(defaultRegistrationInfo.role);
		expect(jwtPayload.type).to.be.eq(AuthTokenType.BASIC);

		// check it registered active session
		let activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);
		expect(activeSessions[0]).to.be.deep.eq({
			authenticatedAtUNIX: jwtPayload.iat,
			accountId,
			ip: '158.56.89.230',
			device: hostname(),
			location: validAuthRequest.location
		});

		// check it deleted auth session
		const authSession = await basicAuthEngineConfig.repositories.authenticationSession.read(validAuthRequest.username, validAuthRequest.device);
		expect(authSession).to.be.eq(null);

		// check if scheduled active session deletion
		await chrono.sleep(basicAuthEngineConfig.jwt.rolesTtl!.get(defaultRegistrationInfo.role)! * 1000);
		activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(0);
	});

	it("authenticates the user, registers active session, schedules it's deletion, deletes auth temp session (mfa enabled)", async () => {
		// expected flow: dispatch -> secret -> generate totp => dispatch -> totp -> authenticated

		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		await AuthEngineInstance.enableMultiFactorAuthentication(accountId);

		const authStatusSecretStep = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(authStatusSecretStep.nextStep!).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

		const totp = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];
		const authStatusTotpStep = await AuthEngineInstance.authenticate({ ...validAuthRequest, totp });

		// check issued valid jwt
		const jwtPayload = await basicAuthEngineConfig.jwt.instance.validate(authStatusTotpStep.token!);
		expect(jwtPayload.sub).to.be.eq(accountId);
		expect(jwtPayload.aud).to.be.eq(defaultRegistrationInfo.role);
		expect(jwtPayload.type).to.be.eq(AuthTokenType.BASIC);

		// check it registered active session
		let activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(1);
		expect(activeSessions[0]).to.be.deep.eq({
			authenticatedAtUNIX: jwtPayload.iat,
			accountId,
			ip: '158.56.89.230',
			device: hostname(),
			location: validAuthRequest.location
		});

		// check it deleted auth session
		const authSession = await basicAuthEngineConfig.repositories.authenticationSession.read(validAuthRequest.username, validAuthRequest.device);
		expect(authSession).to.be.eq(null);

		// check if scheduled active session deletion
		await chrono.sleep(basicAuthEngineConfig.jwt.rolesTtl!.get(defaultRegistrationInfo.role)! * 1000);
		activeSessions = await AuthEngineInstance.getActiveSessions(accountId);
		expect(activeSessions.length).to.be.eq(0);
	});

	it('authenticates the user, issues token using expiration from jwt instance when roles ttl map is not provided', async () => {
		const config = { ...AuthenticationEngineConfig };
		// @ts-ignore
		config.jwt.rolesTtl = undefined;
		const AuthEngine = new AuthenticationEngine(config);
		await AuthEngine.register(defaultRegistrationInfo, { enabled: true });
		await validateSuccessfulLogin(AuthEngine, validAuthRequest);
	});

	it('authenticates user after soft error occurred in secret step, expect failed auth session to be cleared', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });
		await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });

		// second time will work, also needs to reset failed auth attempts
		let authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(authStatus.token).to.not.be.eq(undefined);

		// now retry again till hard error, counter needs to be 0 again
		let maxAllowedFailedAuthAttempts = AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts! - 1; // on last it will disable account
		// eslint-disable-next-line no-plusplus
		while (maxAllowedFailedAuthAttempts--) {
			authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
			expect(authStatus.error!.soft).to.not.be.eq(undefined);
			expect(authStatus.error!.hard).to.be.eq(undefined);
		}

		const failedAuthAttemptsSession = await AuthenticationEngineConfig.repositories.failedAuthAttemptSession.read(defaultRegistrationInfo.username);
		expect(failedAuthAttemptsSession!.counter).to.be.eq(2);
	});

	it('authenticates user after soft error occurred in totp multi factor auth step, expect failed auth session to be cleared', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

		let authStatus = await AuthEngineInstance.authenticate(validAuthRequest);
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

		const totp = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0];

		authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, totp: 'invalid' });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.PASSWORD);
		expect(authStatus.error!.soft).to.not.be.eq(undefined);

		// second time will work, also needs to reset failed auth attempts
		authStatus = await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, totp });

		// now retry again till hard error, counter needs to be 0 again
		let maxAllowedFailedAuthAttempts = AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts! - 1; // on last it will disable account
		// eslint-disable-next-line no-plusplus
		while (maxAllowedFailedAuthAttempts--) {
			authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
			expect(authStatus.error!.soft).to.not.be.eq(undefined);
			expect(authStatus.error!.hard).to.be.eq(undefined);
		}

		const failedAuthAttemptsSession = await AuthenticationEngineConfig.repositories.failedAuthAttemptSession.read(defaultRegistrationInfo.username);
		expect(failedAuthAttemptsSession!.counter).to.be.eq(2);
	});

	it('authenticates after soft errors occurred in secret step and recaptcha was activated (multi factor auth disabled)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		async function authenticateAfterSoftErrorInRecaptchaStep() {
			let recaptchaThreshold = AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!;
			// eslint-disable-next-line no-plusplus
			while (recaptchaThreshold--) {
				await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
			}

			// now provide correct info along with correct recaptcha
			await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, recaptcha: 'valid' }); // this is how validator is implemented
		}

		// try first time
		await authenticateAfterSoftErrorInRecaptchaStep();

		// try second time, should work, as auth session along with failed auth attempts sessions were destroyed
		await authenticateAfterSoftErrorInRecaptchaStep();
	});

	it('authenticates after soft errors occurred in secret step and recaptcha was activated (multi factor auth enabled)', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

		// trigger recaptcha
		let recaptchaThreshold = AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!;
		// eslint-disable-next-line no-plusplus
		while (recaptchaThreshold--) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		// provide valid recaptcha
		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, recaptcha: 'valid' });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);

		const [totp] = SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone);
		await validateSuccessfulLogin(AuthEngineInstance, { ...validAuthRequest, totp });
	});

	it('aborts authentication after hard error occurred in secret step (recaptcha not required and mfa disabled)', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		let lastAuthStatus: any;
		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			lastAuthStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		expect(lastAuthStatus!.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.eq(undefined);
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
	});

	it('aborts authentication after hard error occurred in recaptcha step (mfa disabled)', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		for (
			let i = AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!;
			i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!;
			i++
		) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, recaptcha: 'invalid' });
		}

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.eq(undefined);
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
	});

	it('aborts authentication after hard error occurred in mfa step (recaptcha required)', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		const recaptchaAuthStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, recaptcha: 'valid' });
		expect(recaptchaAuthStatus.nextStep).to.be.eq(AuthenticationStepName.TWO_FACTOR_AUTH_CHECK);
		expect(SmsMockInstance.outboxFor(defaultRegistrationInfo.telephone)[0]).to.not.be.eq(undefined);

		for (
			let i = AuthenticationEngineConfig.thresholds!.failedAuthAttemptsRecaptcha!;
			i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!;
			i++
		) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, totp: 'invalid' });
		}

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.eq(undefined);
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
	});

	it('stores failed auth attempts after account was disabled when failure threshold reached (only the last one ip and device)', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

		const POOL_SIZE = 100;
		const ipPool = [];
		const devicePool = [];
		for (let i = 0; i < POOL_SIZE; i++) {
			ipPool.push(`ip${i}`);
			devicePool.push(`device${i}`);
		}

		let lastIp;
		let lastDevice;
		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			lastIp = ipPool[number.generateArbitrary(0, POOL_SIZE)];
			lastDevice = devicePool[number.generateArbitrary(0, POOL_SIZE)];
			await AuthEngineInstance.authenticate({
				...validAuthRequest,
				password: 'invalid',
				ip: lastIp,
				device: lastDevice
			});
		}

		const failedAuthAttempts = await AuthEngineInstance.getFailedAuthAttempts(accountId);
		expect(failedAuthAttempts.length).to.be.eq(1);

		expect(failedAuthAttempts[0].ip).to.be.eq(lastIp);
		expect(failedAuthAttempts[0].device).to.be.eq(lastDevice);
	});

	it('disables account on reached failure threshold, even if storing failed auth attempts or deleting failed auth attempts session failed', async () => {
		failureWillBeGeneratedForEntityOperation(ENTITIES_OP.FAILED_AUTH_ATTEMPTS_CREATE);
		failureWillBeGeneratedForSessionOperation(SESSIONS_OP.FAILED_AUTH_ATTEMPTS_SESSION_DELETE);

		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true, enableMultiFactorAuth: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		const failedAuthAttempts = await AuthEngineInstance.getFailedAuthAttempts(accountId);
		expect(failedAuthAttempts.length).to.be.eq(0);

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(authStatus.token).to.be.eq(undefined);
		expect(authStatus.nextStep).to.be.eq(undefined);
		expect(authStatus.error!.soft).to.be.eq(undefined);
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
		expect(authStatus.error!.hard).to.haveOwnProperty('message', `Account with id ${accountId} is disabled. `);
	});

	it('schedules account enabling when failed auth attempts threshold has been reached', async () => {
		const accountId = await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		const failedAuthAttempts = await AuthEngineInstance.getFailedAuthAttempts(accountId);
		expect(failedAuthAttempts.length).to.be.eq(1);

		const expectedFailAuthStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(expectedFailAuthStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		await chrono.sleep(chrono.minutesToSeconds(AuthenticationEngineConfig.thresholds!.enableAccountAfterAuthFailureDelayMinutes!) * 1000);

		await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);
	}).timeout(5000);

	it('schedules account enabling when failed auth attempts threshold has been reached only after disabling succeeded', async () => {
		failureWillBeGeneratedForEntityOperation(ENTITIES_OP.ACCOUNT_DISABLE);

		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		let thrownError;
		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			try {
				await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
			} catch (e) {
				thrownError = e;
			}
		}

		expect(hasActiveTimers()).to.be.eq(false);
		expect(thrownError).to.haveOwnProperty('message', 'Account disable was scheduled to fail');
	});

	it('keeps account disabled if account enabling failed after failed auth attempts threshold reached', async () => {
		failureWillBeGeneratedWhenScheduling(SCHEDULING_OP.ENABLE_ACCOUNT);

		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		let thrownError;
		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			try {
				await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
			} catch (e) {
				thrownError = e;
			}
		}

		expect(hasActiveTimers()).to.be.eq(false);
		expect(thrownError).to.haveOwnProperty('message', 'Scheduling account enabling was configured to fail');

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(authStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);
	});

	it('keeps account disabled if creating failed auth attempt model failed', async () => {
		failureWillBeGeneratedForEntityOperation(ENTITIES_OP.FAILED_AUTH_ATTEMPTS_CREATE);

		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		for (let i = 0; i < AuthenticationEngineConfig.thresholds!.maxFailedAuthAttempts!; i++) {
			await AuthEngineInstance.authenticate({ ...validAuthRequest, password: 'invalid' });
		}

		expect(hasActiveTimers()).to.be.eq(true);

		const expectedNegativeAuthStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest });
		expect(expectedNegativeAuthStatus.error!.hard).to.be.instanceOf(Exception).and.to.haveOwnProperty('code', ErrorCodes.ACCOUNT_DISABLED);

		await chrono.sleep(chrono.minutesToSeconds(AuthenticationEngineConfig.thresholds!.enableAccountAfterAuthFailureDelayMinutes!) * 1000);

		await validateSuccessfulLogin(AuthEngineInstance, validAuthRequest);
	}).timeout(5000);

	it('authenticates the user using challenge response authentication method', async () => {
		await AuthEngineInstance.register(defaultRegistrationInfo, { enabled: true });

		const authStatus = await AuthEngineInstance.authenticate({ ...validAuthRequest, generateChallenge: true });
		expect(authStatus.nextStep).to.be.eq(AuthenticationStepName.CHALLENGE_RESPONSE);
		expect(authStatus.token).to.not.be.eq(undefined);

		const signature = signChallengeNonce(authStatus.token!);
		const authRequest = {
			...validAuthRequest,
			responseForChallenge: { signature, signAlgorithm: 'RSA-SHA512', signEncoding: 'base64' as HexBase64Latin1Encoding }
		};

		await validateSuccessfulLogin(AuthEngineInstance, authRequest);

		// session was deletion, prevent replay attacks with already emitted nonce
		expect(await AuthenticationEngineConfig.repositories.authenticationSession.read(defaultRegistrationInfo.username, validAuthRequest.device)).to.be.eq(
			null
		);
	});

	it('authenticates user having password hashed with old algorithm, after password hashing algorithm changes', async () => {
		const [authEngineHashAlg1, authEngineHashAlg2] = createAuthEnginesWithDifferentPasswordHashingAlg(AuthenticationEngineConfig);

		await authEngineHashAlg1.register(defaultRegistrationInfo, { enabled: true });

		await validateSuccessfulLogin(authEngineHashAlg2, validAuthRequest);
	});

	it('authenticates users having passwords hashed with different algorithms', async () => {
		const [authEngineHashAlg1, authEngineHashAlg2] = createAuthEnginesWithDifferentPasswordHashingAlg(AuthenticationEngineConfig);

		const account1 = defaultRegistrationInfo;
		const account2 = {
			...defaultRegistrationInfo,
			username: string.generateStringOfLength(10),
			password: string.generateStringOfLength(30)
		};

		await authEngineHashAlg1.register(account1, { enabled: true });
		await authEngineHashAlg2.register(account2, { enabled: true });

		await validateSuccessfulLogin(authEngineHashAlg1, validAuthRequest);
		await validateSuccessfulLogin(authEngineHashAlg2, {
			...validAuthRequest,
			username: account2.username,
			password: account2.password
		});
	});
});
