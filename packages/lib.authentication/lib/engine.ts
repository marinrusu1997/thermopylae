import { ErrorCodes as CoreErrorCodes } from '@thermopylae/core.declarations';

import { ChangeForgottenPasswordRequest, ChangePasswordRequest, CreateForgotPasswordSessionRequest, RegistrationRequestBase } from './types/requests';
import { AuthenticationStatus } from './authentication/step';
import {
	AccountRepository,
	AuthenticationSessionRepository,
	FailedAuthAttemptSessionRepository,
	FailedAuthenticationAttemptsRepository,
	ForgotPasswordSessionRepository,
	SuccessfulAuthenticationsRepository
} from './types/repositories';
import { createException, ErrorCodes } from './error';
import { AuthenticationOrchestrator } from './authentication/orchestrator';
import { AuthenticationStepName } from './types/enums';
import { DispatchStep } from './authentication/steps/dispatch-step';
import { PasswordStep } from './authentication/steps/password-step';
import { TwoFactorAuthStep } from './authentication/steps/2fa-step';
import { GenerateTwoFactorAuthTokenStep } from './authentication/steps/generate-2fa-token-step';
import { RecaptchaStep, RecaptchaValidator } from './authentication/steps/recaptcha-step';
import { ErrorStep } from './authentication/steps/error-step';
import { AuthenticatedStep } from './authentication/steps/authenticated-step';
import { PasswordsManager } from './managers/password';
import type { EmailSender } from './side-channels';
import type { AccountModel, FailedAuthenticationModel, UserCredentials } from './types/models';
import { ChallengeResponseStep, ChallengeResponseValidator } from './authentication/steps/challenge-response-step';
import { GenerateChallengeStep } from './authentication/steps/generate-challenge-step';
import { AccountManager } from './managers/account';
import type { OnAccountDisabledHook } from './hooks';
import type { AuthenticationContext } from './types/contexts';
import { PasswordStrengthPolicyValidator } from './managers/password/strength/policy';

// @fixme implement something like password confirmation, like when deleting repo on github,
//	it requires from user his password, validate it, and then perform action,
//	notice that on further actions of same kind, password is no longer needed (i think client stores some token from backend)

// @fixme minimize as much as possible number of interactions between app and DB/Redis

// @fixme add support for google otp generator from mobile device

// @fixme add suport for forcefull change of password once in 3 months

// @fixme add suport to detect that new password is not identic (or almost identic) with old one

// @fixme please review this https://www.youtube.com/watch?v=5rjjCZmbB6c before refactoring

// @fixme  Security questions are no longer recognized as an acceptable authentication factor per NIST SP 800-63. they have nothing to do here

// @fixme remember me feature https://paragonie.com/blog/2015/04/secure-authentication-php-with-long-term-persistence#title.2

// @fixme take care with password reset, must be done with certificates https://paragonie.com/blog/2015/04/secure-authentication-php-with-long-term-persistence#title.2

// @fixme allow explicit account close by users

// @fixme feature for password expiration (i.e. to change at each x months)

// @fixme feature for account expiration

// @fixme add support for https://github.com/fido-alliance/webauthn-demo

// @fixme feature email authentication

// @fixme we can also do password verification by using SECURITY DEFINED DATABASE FUNCTIONS to prevent SQLi
//		1. we store password hashes + salts in a different table, and prevent the application to read from it
//		2. then we create 2 database functions
//			2.1 first will compute password hash, given the salt (which he will read from table) and provided password
//			2.2	second will compare computed with stored password hash to check matching
// @fixme this might imply that password hashing can be done by database function an then do an insert in that table
// @fixme this also will imply that we will have two hooks for password hash and password verify
//		1. when we use techniques above, they will simply invoke database functions
//		2. when we do normal way, they will call argon2 from NodeJS process
// @fixme take care with error handling

// @fixme when issuing tokens for password reset, account activation, etc, encode them with the following scheme
// userid:token (it would be nice if they weren't separated, so that attacker can't guess user id from token)
// this is a protection against brute force attacks

// @fixme compare all tokens using constant time string comparison (e.g. password hashes, some tokens, etc)
// https://snyk.io/blog/node-js-timing-attack-ccc-ctf/ (npm packages can be found in the Summary section)

// @fixme also for tokens, it would be recommended to use HMAC, and secret to be kept outside of the db
// this way if tokens are leaked, they are useless without that secret

// @fixme we need multiple 2nd factor auth strategies (sms, google, push notifications, qr codes etc.)
// https://venturebeat.com/2017/09/24/a-guide-to-common-types-of-two-factor-authentication/
// consider to encrypt totp secrets before storing them https://security.stackexchange.com/questions/181184/storing-totp-secret-in-database-plaintext-or-encrypted
// with sms we can use something custom
// qr code example https://davidwalsh.name/2fa

// @fixme when we get to password strength, we can have multiple policies that follow common interface
// 1. owasp or that stuff from https://paragonie.com/blog/2015/04/secure-authentication-php-with-long-term-persistence#title.2
// 2. local test against most common passwords https://github.com/danielmiessler/SecLists/tree/master/Passwords/Common-Credentials
// 3. call to external api service have been pwned to check password
// this can be done via Chain of Responsibility design pattern

// @fixme when locking out user accounts, we can do the following scheme to reduce number of interrogations to sql
// we will store in the account the `lockedUntil` field, which will hold a UNIX timestamp until account is locked,
// when we get account from db, we check for this field whether is greater or equal to current timestamp,
// and if so, we deny auth or any other account manipulation actions
// otherwise, only on auth operation, if we see that value differs from 0, we issue an unlock operation, and set it to 0 on db
// if we see that value is 0, then we do nothing, account is unlocked

class AuthenticationEngine<Account extends AccountModel> {
	private readonly options: AuthenticationEngineOptions<Account>;

	private readonly accountManager: AccountManager<Account>;

	private readonly authenticationOrchestrator: AuthenticationOrchestrator<Account>;

	private readonly passwordsManager: PasswordsManager<Account>;

	public constructor(options: AuthenticationEngineOptions<Account>) {
		this.options = fillWithDefaults(options);

		this.accountManager = new AccountManager(
			this.options.contacts.adminEmail,
			this.options['side-channels'].email,
			this.options.repositories.account,
			this.options.hooks.onAccountDisabled
		);

		this.passwordsManager = new PasswordsManager(
			this.options.password.hashing,
			this.options.password.strengthValidators,
			this.options.repositories.account,
			this.options['side-channels'].email
		);

		this.authenticationOrchestrator = new AuthenticationOrchestrator<Account>(AuthenticationStepName.DISPATCH);
		this.authenticationOrchestrator.register(AuthenticationStepName.DISPATCH, new DispatchStep());
		this.authenticationOrchestrator.register(AuthenticationStepName.PASSWORD, new PasswordStep(this.passwordsManager));
		this.authenticationOrchestrator.register(
			AuthenticationStepName.GENERATE_2FA_TOKEN,
			new GenerateTwoFactorAuthTokenStep(this.options['side-channels'].sms, this.totpManager)
		);
		this.authenticationOrchestrator.register(
			AuthenticationStepName.TWO_FACTOR_AUTH_CHECK,
			new TwoFactorAuthStep(this.options['side-channels'].email, this.totpManager)
		);
		this.authenticationOrchestrator.register(AuthenticationStepName.RECAPTCHA, new RecaptchaStep(this.options.validators.recaptcha));
		this.authenticationOrchestrator.register(
			AuthenticationStepName.ERROR,
			new ErrorStep(
				this.options.thresholds.maxFailedAuthAttempts,
				this.options.thresholds.recaptcha,
				this.options.ttl.failedAuthAttemptsSessionMinutes,
				this.accountManager,
				this.options.repositories.failedAuthAttemptsSession,
				this.options.repositories.failedAuthAttempts
			)
		);
		this.authenticationOrchestrator.register(
			AuthenticationStepName.AUTHENTICATED,
			new AuthenticatedStep(
				this.options['side-channels'].email,
				this.options.repositories.accessPoint,
				this.options.repositories.failedAuthAttemptsSession
			)
		);
		if (this.options.validators.challengeResponse) {
			this.authenticationOrchestrator.register(AuthenticationStepName.GENERATE_CHALLENGE, new GenerateChallengeStep(this.options.tokensLength));
			this.authenticationOrchestrator.register(
				AuthenticationStepName.CHALLENGE_RESPONSE,
				new ChallengeResponseStep(this.options.validators.challengeResponse)
			);
		}
	}

	public async authenticate(authRequest: AuthenticationContext): Promise<AuthenticationStatus> {
		const account = await this.options.repositories.account.read(authRequest.username);

		if (!account) {
			return { error: { hard: createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account ${authRequest.username} not found. `) } };
		}

		if (!account.disabledUntil) {
			return { error: { hard: createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled. `) } };
		}

		// auth session is based and on device too, in order to prevent collisions with other auth sessions which may take place simultaneously
		let onGoingAuthSession = await this.options.repositories.onGoingAuthSession.read(authRequest.username, authRequest.device);
		if (!onGoingAuthSession) {
			onGoingAuthSession = {
				recaptchaRequired: false
			};
			await this.options.repositories.onGoingAuthSession.insert(
				authRequest.username,
				authRequest.device,
				onGoingAuthSession,
				this.options.ttl.authSessionMinutes
			);
		}

		const result = await this.authenticationOrchestrator.authenticate(authRequest, account, onGoingAuthSession);

		if (result.nextStep) {
			// will be reused on auth continuation from previous step
			await this.options.repositories.onGoingAuthSession.replace(authRequest.username, authRequest.device, onGoingAuthSession);
		} else {
			// on success or hard error not needed anymore
			await this.options.repositories.onGoingAuthSession.delete(authRequest.username, authRequest.device);
		}

		return result;
	}

	public async register(registrationInfo: RegistrationRequestBase, options?: Partial<RegistrationOptions>): Promise<string> {
		options = options || {};
		options.enableMultiFactorAuth = (options && options.enableMultiFactorAuth) || false;
		options.enabled = (options && options.enabled) || false;

		// @fixme this can be minimized at insert (i.e. SQL can throw on unique username)
		const account = await this.options.repositories.account.read(registrationInfo.username);
		if (account) {
			throw createException(ErrorCodes.ACCOUNT_ALREADY_REGISTERED, `Account ${registrationInfo.username} is registered already.`);
		}

		await this.passwordsManager.validateStrength(registrationInfo.password);
		const passwordHash = await this.passwordsManager.hash(registrationInfo.password);
		const registeredAccount: AccountModel = {
			username: registrationInfo.username,
			password: passwordHash.hash,
			alg: passwordHash.alg,
			salt: passwordHash.salt,
			telephone: registrationInfo.telephone, // @fixme templates
			email: registrationInfo.email,
			role: registrationInfo.role,
			disabledUntil: options.enabled,
			mfa: options.enableMultiFactorAuth,
			pubKey: registrationInfo.pubKey
		};
		registeredAccount.id = await this.options.repositories.account.insert(registeredAccount);

		/**
		 * @fixme algorithm:
		 * 	1. if account is enabled at it's creation, just save it in database and that's it
		 * 	2. if account is not enabled then:
		 * 		2.1	create account object
		 * 		2.2 create activate account token (5-10 min should be more than enough, anyway in the worst case then will need to register again)
		 * 		2.3 save account object in Redis under activate account token
		 * 			2.4.1 when user sends back that token, read account from Redis and then store it in DB
		 * 			2.4.2 when user doesn't send back that token, session from Redis will expire, and that's it :))
		 * 				  he will have to reenter back details and register
		 */

		if (!options.enabled) {
			let activateToken: string;
			let deleteAccountTaskId;
			let activateAccountSessionWasCreated = false;
			try {
				activateToken = await uidSafe(this.options.tokensLength);
				deleteAccountTaskId = await this.options.schedulers.account.deleteUnactivated(
					registeredAccount.id,
					chrono.fromUnixTime(chrono.unixTime() + chrono.minutesToSeconds(this.options.ttl.activateAccountSessionMinutes))
				);
				await this.options.repositories.activateAccountSession.create(
					activateToken,
					{ accountId: registeredAccount.id, taskId: deleteAccountTaskId },
					this.options.ttl.activateAccountSessionMinutes
				);
				activateAccountSessionWasCreated = true;
				await this.options['side-channels'].email.sendActivateAccountToken(registeredAccount.email, activateToken);
			} catch (e) {
				if (deleteAccountTaskId) {
					// in future it's a very very small chance to id collision, so this task may scheduleDeletion account of the other valid user
					await this.options.schedulers.account.cancelDeleteUnactivated(deleteAccountTaskId); // task cancelling is not allowed to throw
				}
				await this.options.repositories.account.delete(registeredAccount.id);
				if (activateAccountSessionWasCreated) {
					await this.options.repositories.activateAccountSession.delete(activateToken!);
				}
				throw e;
			}
		}

		return registeredAccount.id;
	}

	public async activateAccount(activateAccountToken: string): Promise<void> {
		const session = await this.options.repositories.activateAccountSession.read(activateAccountToken);
		if (!session) {
			throw createException(ErrorCodes.SESSION_NOT_FOUND, `Activate account session identified by provided token ${activateAccountToken} not found. `);
		}

		// it's pointless to activate users account if canceling it's scheduled deletion fails
		await this.options.schedulers.account.cancelDeleteUnactivated(session.taskId);

		await Promise.all([
			this.options.repositories.account.enable(session.accountId),
			this.options.repositories.activateAccountSession
				.delete(activateAccountToken)
				.catch((err) =>
					logger.error(`Failed to delete activate account session with id ${activateAccountToken} for account with id ${session.accountId}. `, err)
				)
		]);
	}

	// @fixme can be done only by authenticated user
	public enableMultiFactorAuthentication(accountId: string): Promise<void> {
		return this.options.repositories.account.enableMultiFactorAuth(accountId);
	}

	// @fixme can be done only by authenticated user
	public disableMultiFactorAuthentication(accountId: string): Promise<void> {
		return this.options.repositories.account.disableMultiFactorAuth(accountId);
	}

	// @fixme can be done only by authenticated user
	public getFailedAuthAttempts(accountId: string, startingFrom?: Date, endingTo?: Date): Promise<Array<FailedAuthenticationModel>> {
		return this.options.repositories.failedAuthAttempts.readRange(accountId, startingFrom, endingTo);
	}

	// @fixme can be done only by authenticated user, and only password of his account
	public async changePassword(changePasswordRequest: ChangePasswordRequest): Promise<void> {
		const account = await this.options.repositories.account.readById(changePasswordRequest.accountId);

		if (!account) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id ${changePasswordRequest.accountId} not found. `);
		}
		if (!account.disabledUntil) {
			// just in case session invalidation failed when account was disabled
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${changePasswordRequest.accountId} is disabled. `);
		}

		// @fixme here we should also employ 2fa (ideally it would be that user already sends totp token, so we don't need to create temp sessions)

		const passwordHash = {
			hash: account.password,
			salt: account.salt,
			alg: account.alg
		};

		if (!(await this.passwordsManager.isSame(changePasswordRequest.oldPassword, passwordHash))) {
			// @FIXME this is almost the same as auth, we should also employ there account lockout policies
			throw createException(ErrorCodes.INCORRECT_PASSWORD, "Old passwords doesn't match. ");
		}

		// now that we know that old password is correct, we can safely check for equality with the new one
		// @fixme do it with the help of https://www.npmjs.com/package/string-similarity, to check for similarities and impose a threshold
		if (changePasswordRequest.oldPassword === changePasswordRequest.newPassword) {
			throw createException(ErrorCodes.SAME_PASSWORD, 'New password is same as the old one. ');
		}

		// additional checks are not made, as we rely on authenticate step, e.g. for disabled accounts all sessions are invalidated

		await this.passwordsManager.change(changePasswordRequest.accountId, changePasswordRequest.newPassword);

		if (typeof changePasswordRequest.logAllOtherSessionsOut !== 'boolean') {
			// by default logout from all devices, needs to be be done, as usually jwt will be long lived
			changePasswordRequest.logAllOtherSessionsOut = true;
		}

		// @fixme specify this in the JSDoc
		if (changePasswordRequest.logAllOtherSessionsOut) {
			return this.userSessionsManager.deleteAllButCurrent(account.id!, account.role, changePasswordRequest.sessionId);
		}
	}

	public async createForgotPasswordSession(forgotPasswordRequest: CreateForgotPasswordSessionRequest): Promise<void> {
		if (!AuthenticationEngine.ALLOWED_SIDE_CHANNELS.includes(forgotPasswordRequest['2fa-channel'])) {
			const errMsg = `Side-Channel ${
				forgotPasswordRequest['2fa-channel']
			} is UNKNOWN. Allowed side-channels are: ${AuthenticationEngine.ALLOWED_SIDE_CHANNELS.join(', ')}`;
			throw createException(CoreErrorCodes.UNKNOWN, errMsg);
		}

		const account = await this.options.repositories.account.read(forgotPasswordRequest.username);
		if (!account) {
			// silently discard invalid username, in order to prevent user enumeration
			return;
		}

		if (!account.disabledUntil) {
			// it's pointless to use forgot password sequence for a disabled account
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled. `);
		}

		const sessionToken = await uidSafe(this.options.tokensLength);
		await this.options.repositories.forgotPasswordSession.insert(
			sessionToken,
			{ accountId: account.id!, accountRole: account.role },
			this.options.ttl.forgotPasswordSessionMinutes
		);

		// @fixme this is like 2fa, i.e. we should better not use sms and email, but push notifications, qr codes & otp etc.
		try {
			// WE HAVE CHECKED THEM AT THE METHOD START!!!
			// eslint-disable-next-line default-case
			switch (forgotPasswordRequest['2fa-channel']) {
				case SIDE_CHANNEL.EMAIL:
					await this.options['side-channels'].email.sendForgotPasswordToken(account.email, sessionToken);
					break;
				case SIDE_CHANNEL.SMS:
					await this.options['side-channels'].sms.sendForgotPasswordToken(account.telephone, sessionToken);
					break;
			}
		} catch (err) {
			logger.error(`Failed to send forgot password token for account ${account.id}. Deleting session with id ${sessionToken}. `, err);
			await this.options.repositories.forgotPasswordSession.delete(sessionToken);
			throw err;
		}
	}

	public async changeForgottenPassword(changeForgottenPasswordRequest: ChangeForgottenPasswordRequest): Promise<void> {
		const forgotPasswordSession = await this.options.repositories.forgotPasswordSession.read(changeForgottenPasswordRequest.token);
		if (!forgotPasswordSession) {
			throw createException(
				ErrorCodes.SESSION_NOT_FOUND,
				`Forgot password session identified by provided token ${changeForgottenPasswordRequest.token} not found. `
			);
		}

		/*
		 * we are not doing password duplicate check for the following reasons:
		 * 	- it will require to read account from database, which is too expensive
		 * 	- we can store password in change forgotten password session, which is risky
		 * 	- the whole point of the forgot password is that user doesn't remember the old one,
		 * 	  therefore in real life duplicate scenario won't likely to occur
		 * 	- after all, it's not a big problem if we allow new password to be the same as the old one
		 */
		await this.passwordsManager.change(forgotPasswordSession.accountId, changeForgottenPasswordRequest.newPassword);

		try {
			// prevent replay attacks
			await this.options.repositories.forgotPasswordSession.delete(changeForgottenPasswordRequest.token);
			await this.logoutFromAllDevices({ sub: forgotPasswordSession.accountId, aud: forgotPasswordSession.accountRole });
		} catch (error) {
			// operation is considered successful, even if some of the clean up steps fails
			logger.error(`Failed to clean up forgot password session for account ${forgotPasswordSession.accountId}. `, error);
		}
	}

	// @fixme can be done only by authenticated user or some external TRUSTED service
	public async areAccountCredentialsValid(accountId: string, credentials: UserCredentials): Promise<boolean> {
		const account = await this.options.repositories.account.readById(accountId);

		if (!account) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id ${accountId} not found. `);
		}

		if (!account.disabledUntil) {
			// disabled account can't be used in order to invoke other operations
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled. `);
		}

		if (!(credentials.username === account.username)) {
			return false;
		}

		const passwordHash = {
			hash: account.password,
			salt: account.salt,
			alg: account.alg
		};

		// @FIXME this is almost the same as auth, we should also employ there account lockout policies
		return this.passwordsManager.isSame(credentials.password, passwordHash);
	}

	// @fixme can be done only by admin or other internal procedures
	public async enableAccount(accountId: string): Promise<void> {
		await this.accountManager.enable(accountId);
	}

	// @fixme can be done only by authenticated user or other internal procedures
	public async disableAccount(accountId: string, cause: string): Promise<void> {
		const account = await this.options.repositories.account.readById(accountId);
		if (!account) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id ${accountId} not found. `);
		}
		await this.accountManager.disable(account, cause);
	}
}

interface RegistrationOptions {
	enableMultiFactorAuth: boolean;
	enabled: boolean; // based on user role, account can be activated or not at the registration time
}

interface TTLOptions {
	authSessionMinutes?: number;
	failedAuthAttemptsSessionMinutes?: number;
	activateAccountSessionMinutes?: number;
	forgotPasswordSessionMinutes?: number;
	totpSeconds?: number;
}

interface ThresholdsOptions {
	maxFailedAuthAttempts?: number;
	recaptcha?: number;
	passwordBreach?: number;
	enableAccountAfterAuthFailureDelayMinutes?: number;
}

interface AuthenticationEngineOptions<Account extends AccountModel> {
	repositories: {
		account: AccountRepository<Account>;
		onGoingAuthSession: AuthenticationSessionRepository;
		accessPoint: SuccessfulAuthenticationsRepository;
		failedAuthAttemptsSession: FailedAuthAttemptSessionRepository;
		failedAuthAttempts: FailedAuthenticationAttemptsRepository;
		forgotPasswordSession: ForgotPasswordSessionRepository;
	};
	'side-channels': {
		email: EmailSender;
	};
	hooks: {
		onAccountDisabled: OnAccountDisabledHook<Account>;
	};
	validators: {
		recaptcha: RecaptchaValidator;
		challengeResponse?: ChallengeResponseValidator;
	};
	password: {
		hashing: PasswordHashing;
		strengthValidators: PasswordStrengthPolicyValidator<Account>[];
	};
	ttl: TTLOptions;
	thresholds: ThresholdsOptions;
	tokensLength: number;
	secrets: {
		totp: string;
	};
	contacts: {
		adminEmail: string;
	};
}

function fillWithDefaults(options: AuthenticationEngineOptions): Required<InternalUsageOptions> {
	options.ttl = options.ttl || {};
	options.thresholds = options.thresholds || {};
	options.tokensLength = options.tokensLength || 20;
	return {
		repositories: options.repositories,
		ttl: {
			authSessionMinutes: options.ttl.authSessionMinutes || 2, // this needs to be as short as possible
			failedAuthAttemptsSessionMinutes: options.ttl.failedAuthAttemptsSessionMinutes || 10,
			activateAccountSessionMinutes: options.ttl.activateAccountSessionMinutes || 60,
			forgotPasswordSessionMinutes: options.ttl.forgotPasswordSessionMinutes || 5,
			totpSeconds: options.ttl.totpSeconds || 30
		},
		thresholds: {
			maxFailedAuthAttempts: options.thresholds.maxFailedAuthAttempts || 20,
			recaptcha: options.thresholds.recaptcha || 10,
			passwordBreach: options.thresholds.passwordBreach || 5,
			enableAccountAfterAuthFailureDelayMinutes: options.thresholds.enableAccountAfterAuthFailureDelayMinutes || 120
		},
		tokensLength: options.tokensLength,
		passwordHasher: options.passwordHasher,
		secrets: options.secrets,
		contacts: options.contacts,
		'side-channels': options['side-channels'],
		schedulers: options.schedulers,
		validators: options.validators
	};
}

export { AuthenticationEngine, AuthenticationEngineOptions, TTLOptions, ThresholdsOptions, RegistrationOptions, PasswordHasherInterface, PasswordHash };
