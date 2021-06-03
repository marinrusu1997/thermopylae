import { ErrorCodes as CoreErrorCodes, RequireSome, Seconds, Threshold, UnixTimestamp } from '@thermopylae/core.declarations';

import uidSafe from 'uid-safe';
import { compareTwoStrings } from 'string-similarity';
import { publicEncrypt } from 'crypto';
import { AuthenticationStatus } from './authentication/step';
import {
	AccountRepository,
	ActivateAccountSessionRepository,
	AuthenticationSessionRepository,
	FailedAuthAttemptSessionRepository,
	FailedAuthenticationAttemptsRepository,
	ForgotPasswordSessionRepository,
	SuccessfulAuthenticationsRepository
} from './types/repositories';
import { createException, ErrorCodes } from './error';
import { AuthenticationOrchestrator } from './authentication/orchestrator';
import { AccountStatus, AuthenticationStepName } from './types/enums';
import { DispatchStep } from './authentication/steps/dispatch-step';
import { PasswordStep } from './authentication/steps/password-step';
import { TwoFactorAuthStep } from './authentication/steps/2fa-step';
import { GenerateTwoFactorAuthTokenStep } from './authentication/steps/generate-2fa-token-step';
import { RecaptchaStep, RecaptchaValidator } from './authentication/steps/recaptcha-step';
import { ErrorStep } from './authentication/steps/error-step';
import { AuthenticatedStep } from './authentication/steps/authenticated-step';
import { PasswordHashing, PasswordsManager } from './managers/password';
import type { EmailSender } from './types/side-channels';
import type { AccountModel, FailedAuthenticationModel, UserCredentials } from './types/models';
import { ChallengeResponseStep, ChallengeResponseValidator } from './authentication/steps/challenge-response-step';
import { GenerateChallengeStep } from './authentication/steps/generate-challenge-step';
import { AccountManager } from './managers/account';
import type { OnAccountDisabledHook, OnPasswordChangedHook } from './types/hooks';
import type { AuthenticationContext, ChangePasswordContext, SetTwoFactorAuthenticationContext } from './types/contexts';
import { PasswordStrengthPolicyValidator } from './managers/password/strength/policy';
import { SecretEncryptionOptions, SecretEncryptor } from './helpers/secret-encryptor';
import { TwoFactorAuthStrategy } from './2fa/interface';
import { AuthenticationSessionRepositoryHolder } from './helpers/authentication-session-repository-holder';
import { FailedAuthenticationsManager } from './managers/failed-authentications';
import { TokenManager } from './managers/token';

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

// @fixme implement 2fa with push notifications https://www.npmjs.com/package/node-pushnotifications

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

interface TTLOptions {
	readonly authenticationSession: Seconds;
	readonly failedAuthAttemptsSession: Seconds;
	readonly activateAccountSession: Seconds;
	readonly forgotPasswordSession: Seconds;
	readonly accountDisableTimeout: Seconds;
}

interface ThresholdsOptions {
	readonly maxFailedAuthAttempts: Threshold;
	readonly recaptcha: Threshold;
	readonly passwordSimilarity: Threshold; // @fixme validate
}

interface AuthenticationEngineOptions<Account extends AccountModel> {
	repositories: {
		account: AccountRepository<Account>;
		successfulAuthentications: SuccessfulAuthenticationsRepository;
		failedAuthenticationAttempts: FailedAuthenticationAttemptsRepository;
		authenticationSession: AuthenticationSessionRepository;
		failedAuthAttemptSession: FailedAuthAttemptSessionRepository;
		forgotPasswordSession: ForgotPasswordSessionRepository;
		activateAccountSession: ActivateAccountSessionRepository<Account>;
	};
	hooks: {
		onAccountDisabled: OnAccountDisabledHook<Account>;
		onPasswordChanged: OnPasswordChangedHook<Account>;
	};
	validators: {
		recaptcha: RecaptchaValidator;
		challengeResponse?: ChallengeResponseValidator;
	};
	password: {
		hashing: PasswordHashing;
		encryption: SecretEncryptionOptions | false;
		strength: PasswordStrengthPolicyValidator<Account>[];
	};
	email: {
		admin: string;
		sender: EmailSender;
	};
	'2fa-strategy': TwoFactorAuthStrategy<Account>;
	ttl: TTLOptions;
	thresholds: ThresholdsOptions;
	tokensLength: number;
}

class AuthenticationEngine<Account extends AccountModel> {
	private readonly options: AuthenticationEngineOptions<Account>;

	private readonly tokenManager: TokenManager;

	private readonly accountManager: AccountManager<Account>;

	private readonly authenticationOrchestrator: AuthenticationOrchestrator<Account>;

	private readonly passwordsManager: PasswordsManager<Account>;

	private readonly failedAuthenticationsManager: FailedAuthenticationsManager<Account>;

	public constructor(options: AuthenticationEngineOptions<Account>) {
		// @fixme do some validations here
		this.options = options;

		this.tokenManager = new TokenManager(this.options.tokensLength);

		this.accountManager = new AccountManager(
			this.options.email.admin,
			this.options.email.sender,
			this.options.repositories.account,
			this.options.hooks.onAccountDisabled
		);

		this.passwordsManager = new PasswordsManager(
			this.options.password.hashing,
			new SecretEncryptor(this.options.password.encryption),
			this.options.password.strength,
			this.options.repositories.account,
			this.options.email.sender
		);

		this.failedAuthenticationsManager = new FailedAuthenticationsManager<Account>(
			this.options.thresholds.maxFailedAuthAttempts,
			this.options.ttl.failedAuthAttemptsSession,
			this.options.ttl.accountDisableTimeout,
			this.accountManager,
			this.options.repositories.failedAuthAttemptSession,
			this.options.repositories.failedAuthenticationAttempts
		);

		this.authenticationOrchestrator = new AuthenticationOrchestrator<Account>(AuthenticationStepName.DISPATCH);
		this.authenticationOrchestrator.register(AuthenticationStepName.DISPATCH, new DispatchStep());
		this.authenticationOrchestrator.register(AuthenticationStepName.PASSWORD, new PasswordStep(this.passwordsManager));
		this.authenticationOrchestrator.register(AuthenticationStepName.GENERATE_2FA_TOKEN, new GenerateTwoFactorAuthTokenStep(this.options['2fa-strategy']));
		this.authenticationOrchestrator.register(
			AuthenticationStepName.TWO_FACTOR_AUTH_CHECK,
			new TwoFactorAuthStep(this.options['2fa-strategy'], this.options.email.sender)
		);
		this.authenticationOrchestrator.register(AuthenticationStepName.RECAPTCHA, new RecaptchaStep(this.options.validators.recaptcha));
		this.authenticationOrchestrator.register(
			AuthenticationStepName.ERROR,
			new ErrorStep(this.options.thresholds.maxFailedAuthAttempts, this.options.thresholds.recaptcha, this.failedAuthenticationsManager)
		);
		this.authenticationOrchestrator.register(
			AuthenticationStepName.AUTHENTICATED,
			new AuthenticatedStep(
				this.options.email.sender,
				this.options.repositories.successfulAuthentications,
				this.options.repositories.failedAuthAttemptSession
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

	public async authenticate(authenticationContext: AuthenticationContext): Promise<AuthenticationStatus> {
		const account = await this.accountManager.readByUsername(authenticationContext.username);
		const authenticationSessionRepositoryHolder = new AuthenticationSessionRepositoryHolder(
			this.options.repositories.authenticationSession,
			authenticationContext
		);

		const result = await this.authenticationOrchestrator.authenticate(account, authenticationContext, authenticationSessionRepositoryHolder);
		await authenticationSessionRepositoryHolder.flush(this.options.ttl.authenticationSession);

		return result;
	}

	public async register(account: RequireSome<Partial<Account>, 'username' | 'passwordHash' | 'email' | 'disabledUntil' | 'mfa'>): Promise<void> {
		await this.passwordsManager.hashAndStoreOnAccount(account.passwordHash, account as Account);

		if (account.disabledUntil === AccountStatus.ENABLED) {
			await this.options.repositories.account.insert(account as Account);
			return;
		}

		if (account.disabledUntil === AccountStatus.DISABLED_UNTIL_ACTIVATION) {
			const activateToken = await uidSafe(this.options.tokensLength);
			await this.options.repositories.activateAccountSession.insert(activateToken, account as Account, this.options.ttl.activateAccountSession);
			await this.options.email.sender.sendActivateAccountToken(account.email, activateToken);
			return;
		}

		throw createException(
			CoreErrorCodes.MISCONFIGURATION,
			`Account 'disabledUntil' field should take either ${AccountStatus.ENABLED} or ${AccountStatus.DISABLED_UNTIL_ACTIVATION} values. Given: ${account.disabledUntil}.`
		);
	}

	public async activateAccount(activateAccountToken: string): Promise<void> {
		const unactivatedAccount = await this.options.repositories.activateAccountSession.read(activateAccountToken);
		if (!unactivatedAccount) {
			throw createException(ErrorCodes.SESSION_NOT_FOUND, `Activate account session identified by token ${activateAccountToken} not found.`);
		}

		unactivatedAccount.disabledUntil = AccountStatus.ENABLED;

		await Promise.all([
			this.options.repositories.activateAccountSession.delete(activateAccountToken), // prevent replay
			this.options.repositories.account.insert(unactivatedAccount)
		]);
	}

	// @fixme can be done only by authenticated user
	public async setTwoFactorAuthEnabled(accountId: string, enabled: boolean, context?: SetTwoFactorAuthenticationContext): Promise<void> {
		if (context != null) {
			const account = await this.accountManager.readById(accountId);

			// defense against stolen sessions
			if (!(await this.passwordsManager.isSame(context.password, account.passwordHash, account.passwordSalt, account.passwordAlg))) {
				if (await this.failedAuthenticationsManager.incrementSession(account, context)) {
					throw createException(
						ErrorCodes.INCORRECT_PASSWORD,
						`Can't set two factor authentication for account with id ${account.id}, because given password doesn't match with the account one.`
					);
				} else {
					throw createException(
						ErrorCodes.ACCOUNT_DISABLED,
						`Can't set two factor authentication for account with id ${account.id}, because it was disabled due to reached threshold of failed auth attempts.`
					);
				}
			}
		}

		await this.options.repositories.account.setTwoFactorAuthEnabled(accountId, enabled);
	}

	// @fixme can be done only by authenticated user
	public getFailedAuthAttempts(accountId: string, startingFrom?: UnixTimestamp, endingTo?: UnixTimestamp): Promise<Array<FailedAuthenticationModel>> {
		return this.options.repositories.failedAuthenticationAttempts.readRange(accountId, startingFrom, endingTo);
	}

	/**
	 * Changes users password. <br/>
	 * > **Important!** This method has authorization implications.
	 * > It needs to be called only by authenticated users and they can change only their password.
	 *
	 * @param changePasswordContext			Change password context.
	 */
	public async changePassword(changePasswordContext: ChangePasswordContext): Promise<void> {
		const account = await this.accountManager.readById(changePasswordContext.accountId);

		// defense against stolen sessions
		if (!(await this.passwordsManager.isSame(changePasswordContext.oldPassword, account.passwordHash, account.passwordSalt, account.passwordAlg))) {
			if (await this.failedAuthenticationsManager.incrementSession(account, changePasswordContext)) {
				throw createException(
					ErrorCodes.INCORRECT_PASSWORD,
					`Can't change password for account with id ${account.id}, because old passwords doesn't match.`
				);
			} else {
				throw createException(
					ErrorCodes.ACCOUNT_DISABLED,
					`Can't change password for account with id ${account.id}, because it was disabled due to reached threshold of failed auth attempts.`
				);
			}
		}
		await this.failedAuthenticationsManager.deleteSession(account);

		// now that we know that old password is correct, we can safely check for equality with the new one
		if (compareTwoStrings(changePasswordContext.oldPassword, changePasswordContext.newPassword) >= this.options.thresholds.passwordSimilarity) {
			throw createException(
				ErrorCodes.SIMILAR_PASSWORDS,
				`Can't change password for account with id ${account.id}, because new password is too similar with the old one.`
			);
		}

		// additional checks are not made, as we rely on authenticate step, e.g. for disabled accounts all sessions are invalidated
		await this.passwordsManager.changeAndStoreOnAccount(changePasswordContext.newPassword, account, changePasswordContext);

		await this.options.hooks.onPasswordChanged(account, changePasswordContext);
	}

	public async createForgotPasswordSession(
		accountUniqueFieldName: `readBy${Capitalize<Extract<keyof Account, 'username' | 'email' | 'telephone'>>}`,
		accountUniqueFieldValue: string
	): Promise<void> {
		const account = await this.accountManager[accountUniqueFieldName](accountUniqueFieldValue);

		if (account.pubKey != null) {
			const sessionToken = await this.tokenManager.issueEncoded(account.id);
			await this.options.repositories.forgotPasswordSession.insert(sessionToken, this.options.ttl.forgotPasswordSession);
			// @fixme maybe use sms too
			await this.options.email.sender.sendForgotPasswordToken(account.email, publicEncrypt(account.pubKey, Buffer.from(sessionToken)).toString('utf8'));
		} else if (account.mfa) {
			// generate by 2fa
		} else {
			const sessionToken = await this.tokenManager.issueEncoded(account.id);
			await this.options.repositories.forgotPasswordSession.insert(sessionToken, this.options.ttl.forgotPasswordSession);
			// @fixme maybe use sms too
			await this.options.email.sender.sendForgotPasswordToken(account.email, sessionToken); // without encryption
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
		await this.passwordsManager.changeAndStoreOnAccount(forgotPasswordSession.accountId, changeForgottenPasswordRequest.newPassword);

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

function fillWithDefaults(options: AuthenticationEngineOptions): Required<InternalUsageOptions> {
	options.ttl = options.ttl || {};
	options.thresholds = options.thresholds || {};
	options.tokensLength = options.tokensLength || 20;
	return {
		repositories: options.repositories,
		ttl: {
			authSessionMinutes: options.ttl.authenticationSession || 2, // this needs to be as short as possible
			failedAuthAttemptsSessionMinutes: options.ttl.failedAuthAttemptsSession || 10,
			activateAccountSessionMinutes: options.ttl.activateAccountSession || 60,
			forgotPasswordSessionMinutes: options.ttl.forgotPasswordSession || 5,
			totpSeconds: options.ttl.totpSeconds || 30
		},
		thresholds: {
			maxFailedAuthAttempts: options.thresholds.maxFailedAuthAttempts || 20,
			recaptcha: options.thresholds.recaptcha || 10,
			passwordBreach: options.thresholds.passwordSimilarity || 5,
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
