import { ErrorCodes as CoreErrorCodes, RequireSome, Seconds, Threshold, UnixTimestamp } from '@thermopylae/core.declarations';

import uidSafe from 'uid-safe';
import { compareTwoStrings } from 'string-similarity';
import { publicEncrypt } from 'crypto';
import { createException, ErrorCodes } from './error';
import type { AuthenticationStatus } from './authentication/step';
import type {
	AccountRepository,
	ActivateAccountSessionRepository,
	AuthenticationSessionRepository,
	FailedAuthAttemptSessionRepository,
	FailedAuthenticationAttemptsRepository,
	ForgotPasswordSessionRepository,
	SuccessfulAuthenticationsRepository
} from './types/repositories';
import type { RecaptchaValidator } from './authentication/steps/recaptcha-step';
import { AuthenticationOrchestrator } from './authentication/orchestrator';
import { AccountStatus, AuthenticationStepName } from './types/enums';
import { DispatchStep } from './authentication/steps/dispatch-step';
import { PasswordStep } from './authentication/steps/password-step';
import { TwoFactorAuthStep } from './authentication/steps/2fa-step';
import { GenerateTwoFactorAuthTokenStep } from './authentication/steps/generate-2fa-token-step';
import { RecaptchaStep } from './authentication/steps/recaptcha-step';
import { ErrorStep } from './authentication/steps/error-step';
import { AuthenticatedStep } from './authentication/steps/authenticated-step';
import { PasswordsManager } from './managers/password';
import type { PasswordHashing } from './managers/password';
import type { EmailSender, SmsSender } from './types/side-channels';
import type { AccountModel, FailedAuthenticationModel, SuccessfulAuthenticationModel } from './types/models';
import { ChallengeResponseStep } from './authentication/steps/challenge-response-step';
import type { ChallengeResponseValidator } from './authentication/steps/challenge-response-step';
import { GenerateChallengeStep } from './authentication/steps/generate-challenge-step';
import { AccountManager } from './managers/account';
import type { OnAccountDisabledHook, OnForgottenPasswordChangedHook, OnPasswordChangedHook } from './types/hooks';
import type { AuthenticationContext, BaseContext, ChangePasswordContext, SetTwoFactorAuthenticationContext } from './types/contexts';
import type { PasswordStrengthPolicyValidator } from './managers/password/strength/policy';
import { SecretEncryptor } from './helpers/secret-encryptor';
import type { SecretEncryptionOptions } from './helpers/secret-encryptor';
import { TwoFactorAuthStrategy } from './authentication/2fa/interface';
import { AuthenticationSessionRepositoryHolder } from './helpers/authentication-session-repository-holder';
import { FailedAuthenticationsManager } from './managers/failed-authentications';
import { TokenManager } from './managers/token';

// @fixme minimize as much as possible number of interactions between app and DB/Redis

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

type AccountToBeRegistered<Account extends AccountModel> = RequireSome<Partial<Account>, 'username' | 'passwordHash' | 'email' | 'disabledUntil'>;

interface AuthenticationEngineOptions<Account extends AccountModel> {
	readonly thresholds: {
		readonly maxFailedAuthAttempts: Threshold;
		readonly failedAuthAttemptsRecaptcha: Threshold;
	};
	readonly ttl: {
		readonly authenticationSession: Seconds;
		readonly failedAuthAttemptsSession: Seconds;
		readonly activateAccountSession: Seconds;
		readonly forgotPasswordSession: Seconds;
		readonly accountDisableTimeout: Seconds;
	};
	readonly repositories: {
		readonly account: AccountRepository<Account>;
		readonly successfulAuthentications: SuccessfulAuthenticationsRepository;
		readonly failedAuthenticationAttempts: FailedAuthenticationAttemptsRepository;
		readonly authenticationSession: AuthenticationSessionRepository;
		readonly failedAuthAttemptSession: FailedAuthAttemptSessionRepository;
		readonly forgotPasswordSession: ForgotPasswordSessionRepository;
		readonly activateAccountSession: ActivateAccountSessionRepository<Account>;
	};
	readonly hooks: {
		readonly onAccountDisabled: OnAccountDisabledHook<Account>;
		readonly onPasswordChanged: OnPasswordChangedHook<Account>;
		readonly onForgottenPasswordChanged: OnForgottenPasswordChangedHook<Account>;
	};
	readonly validators: {
		readonly recaptcha: RecaptchaValidator;
		readonly challengeResponse?: ChallengeResponseValidator;
	};
	readonly password: {
		readonly hashing: PasswordHashing;
		readonly encryption: SecretEncryptionOptions | false;
		readonly strength: PasswordStrengthPolicyValidator<Account>[];
		readonly similarity: Threshold;
	};
	readonly email: {
		readonly admin: string;
		readonly sender: EmailSender<Account>;
	};
	readonly smsSender: SmsSender<Account>;
	readonly '2fa-strategy': TwoFactorAuthStrategy<Account>;
	readonly tokensLength: number;
}

class AuthenticationEngine<Account extends AccountModel> {
	private readonly options: AuthenticationEngineOptions<Account>;

	private readonly tokenManager: TokenManager;

	private readonly accountManager: AccountManager<Account>;

	private readonly authenticationOrchestrator: AuthenticationOrchestrator<Account>;

	private readonly passwordsManager: PasswordsManager<Account>;

	private readonly failedAuthenticationsManager: FailedAuthenticationsManager<Account>;

	public constructor(options: AuthenticationEngineOptions<Account>) {
		this.options = AuthenticationEngine.validateOptions(options);

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
			this.options.repositories.account
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
			new ErrorStep(this.options.thresholds.maxFailedAuthAttempts, this.options.thresholds.failedAuthAttemptsRecaptcha, this.failedAuthenticationsManager)
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

	public async register(account: AccountToBeRegistered<Account>): Promise<void> {
		await this.passwordsManager.hashAndStoreOnAccount(account.passwordHash, account as Account);

		account.mfa = false;

		if (account.disabledUntil === AccountStatus.ENABLED) {
			await this.options.repositories.account.insert(account as Account);
			return;
		}

		if (account.disabledUntil === AccountStatus.DISABLED_UNTIL_ACTIVATION) {
			const activateToken = await uidSafe(this.options.tokensLength);
			await this.options.repositories.activateAccountSession.insert(activateToken, account as Account, this.options.ttl.activateAccountSession);
			await this.options.email.sender.sendActivateAccountToken(account as Account, activateToken);
			return;
		}

		throw createException(
			CoreErrorCodes.MISCONFIGURATION,
			`Account 'disabledUntil' field should take either ${AccountStatus.ENABLED} or ${AccountStatus.DISABLED_UNTIL_ACTIVATION} values. Given: ${account.disabledUntil}.`
		);
	}

	public async activateAccount(activateAccountToken: string): Promise<void> {
		const unactivatedAccount = await this.options.repositories.activateAccountSession.read(activateAccountToken);
		if (unactivatedAccount == null) {
			throw createException(ErrorCodes.SESSION_NOT_FOUND, `Activate account session identified by token '${activateAccountToken}' not found.`);
		}

		unactivatedAccount.disabledUntil = AccountStatus.ENABLED;

		await Promise.all([
			this.options.repositories.activateAccountSession.delete(activateAccountToken), // prevent replay
			this.options.repositories.account.insert(unactivatedAccount)
		]);
	}

	/**
	 * Enable/Disable 2 factor authentication on the user's account.
	 * > **Important!** This method has authorization implications.
	 * > It needs to be called only by authenticated users for their account.
	 *
	 * @param accountId		Account id.
	 * @param enabled		Whether it's enabled or not.
	 * @param context		Operation context. @fixme detail it
	 *
	 * @returns				@fixme
	 */
	public async setTwoFactorAuthEnabled(
		accountId: string,
		enabled: boolean,
		context?: SetTwoFactorAuthenticationContext
	): Promise<Record<string, any> | null> {
		const account = await this.accountManager.readById(accountId);

		if (context != null) {
			if (!(await this.verifyPassword(context.password, account, context))) {
				throw createException(
					ErrorCodes.INCORRECT_PASSWORD,
					`Can't set two factor authentication for account with id ${account.id}, because given password doesn't match with the account one.`
				);
			}
		}

		const update: Partial<Account> = {};
		let hookResult: Record<string, any> | null = null;

		if (enabled) {
			hookResult = await this.options['2fa-strategy'].onTwoFactorAuthEnabled(account, update);
		}
		update.mfa = enabled;

		await this.options.repositories.account.update(accountId, update);

		return hookResult;
	}

	/**
	 * Get failed authentication attempts into user account.
	 * > **Important!** This method has authorization implications.
	 * > It needs to be called only by authenticated users for their account or by admin.
	 *
	 * @param accountId				Account id.
	 * @param startingFrom			Starting timestamp.
	 * @param endingTo				Ending timestamp.
	 */
	public getFailedAuthentications(accountId: string, startingFrom?: UnixTimestamp, endingTo?: UnixTimestamp): Promise<Array<FailedAuthenticationModel>> {
		return this.options.repositories.failedAuthenticationAttempts.readRange(accountId, startingFrom, endingTo);
	}

	/**
	 * Get successful authentications into user account.
	 * > **Important!** This method has authorization implications.
	 * > It needs to be called only by authenticated users for their account or by admin.
	 *
	 * @param accountId				Account id.
	 * @param startingFrom			Starting timestamp.
	 * @param endingTo				Ending timestamp.
	 */
	public getSuccessfulAuthentications(
		accountId: string,
		startingFrom?: UnixTimestamp,
		endingTo?: UnixTimestamp
	): Promise<Array<SuccessfulAuthenticationModel>> {
		return this.options.repositories.successfulAuthentications.readRange(accountId, startingFrom, endingTo);
	}

	public async verifyPassword(password: string, account: Account, context: BaseContext): Promise<boolean> {
		// defense against stolen sessions
		if (!(await this.passwordsManager.isSame(password, account.passwordHash, account.passwordSalt, account.passwordAlg))) {
			if (await this.failedAuthenticationsManager.incrementSession(account, context)) {
				return false;
			}

			throw createException(
				ErrorCodes.ACCOUNT_DISABLED,
				`Password verification for account with id ${account.id} failed too many times, therefore account was disabled.`
			);
		}

		return true;
	}

	/**
	 * Changes users password. <br/>
	 * > **Important!** This method has authorization implications.
	 * > It needs to be called only by authenticated users and they can change only their password.
	 *
	 * @param changePasswordContext			Change password context.
	 */
	public async changePassword<Context extends ChangePasswordContext>(changePasswordContext: Context): Promise<void> {
		const account = await this.accountManager.readById(changePasswordContext.accountId);

		if (!(await this.verifyPassword(changePasswordContext.oldPassword, account, changePasswordContext))) {
			throw createException(
				ErrorCodes.INCORRECT_PASSWORD,
				`Can't change password for account with id ${account.id}, because old passwords doesn't match.`
			);
		}
		await this.failedAuthenticationsManager.deleteSession(account);

		// now that we know that old password is correct, we can safely check for equality with the new one
		if (compareTwoStrings(changePasswordContext.oldPassword, changePasswordContext.newPassword) >= this.options.password.similarity) {
			throw createException(
				ErrorCodes.SIMILAR_PASSWORDS,
				`Can't change password for account with id ${account.id}, because new password is too similar with the old one.`
			);
		}

		// additional checks are not made, as we rely on authenticate step, e.g. for disabled accounts all sessions are invalidated
		await this.passwordsManager.changeAndStoreOnAccount(changePasswordContext.newPassword, account);
		await this.options.email.sender.notifyPasswordChanged(account, changePasswordContext);

		await this.options.hooks.onPasswordChanged(account, changePasswordContext);
	}

	public async createForgotPasswordSession(
		accountUniqueFieldName: `readBy${Capitalize<Extract<keyof Account, 'username' | 'email' | 'telephone'>>}`,
		accountUniqueFieldValue: string,
		sideChannel: 'email' | 'sms'
	): Promise<void> {
		const account = await this.accountManager[accountUniqueFieldName](accountUniqueFieldValue);

		const sessionToken = await this.tokenManager.issueEncodedWithAccountId(account.id);
		await this.options.repositories.forgotPasswordSession.insert(sessionToken, this.options.ttl.forgotPasswordSession);

		try {
			if (sideChannel === 'email') {
				await this.options.email.sender.sendForgotPasswordToken(
					account,
					account.pubKey ? publicEncrypt(account.pubKey, Buffer.from(sessionToken)).toString('utf8') : sessionToken
				);
			} else if (sideChannel === 'sms') {
				if (account.telephone == null) {
					throw createException(
						ErrorCodes.NO_TELEPHONE_NUMBER,
						`Can't send forgot password token, because account with id ${account.id} has no telephone number.`
					);
				}

				await this.options.smsSender.sendForgotPasswordToken(
					account,
					account.pubKey ? publicEncrypt(account.pubKey, Buffer.from(sessionToken)).toString('utf8') : sessionToken
				);
			} else {
				throw createException(
					CoreErrorCodes.UNKNOWN,
					`Can't send forgot password token for account with id ${account.id}, because side channel type is unknown.`
				);
			}
		} catch (e) {
			await this.options.repositories.forgotPasswordSession.delete(sessionToken);
			throw e;
		}
	}

	public async changeForgottenPassword(token: string, newPassword: string): Promise<void> {
		if (!(await this.options.repositories.forgotPasswordSession.exists(token))) {
			throw createException(ErrorCodes.SESSION_NOT_FOUND, `Forgot password session identified by token ${token} doesn't exist.`);
		}
		// prevent replay attacks
		await this.options.repositories.forgotPasswordSession.delete(token);

		const account = await this.accountManager.readById(this.tokenManager.extractAccountId(token));

		await this.passwordsManager.changeAndStoreOnAccount(newPassword, account);
		await this.options.hooks.onForgottenPasswordChanged(account);
	}

	/**
	 * Enable user account.
	 * > **Important!** This operation should be done only by admin.
	 *
	 * @param accountId		Account id.
	 */
	public async enableAccount(accountId: string): Promise<void> {
		await this.accountManager.enable(accountId);
	}

	/**
	 * Disable user account. <br/>
	 * > **Important!** This operation should be done only by admin, or by application's business logic.
	 *
	 * @param accountId		Account id.
	 * @param until			Unix timestamp until account will be disabled. <br/>
	 * 						Use {@link UnixTimestamp | AccountStatus.DISABLED_UNTIL_ACTIVATION} to disable account for an undefined amount of time.
	 * @param cause			String message that contains explanation why account is disabled.
	 */
	public async disableAccount(accountId: string, until: UnixTimestamp | AccountStatus.DISABLED_UNTIL_ACTIVATION, cause: string): Promise<void> {
		const account = await this.accountManager.readById(accountId);
		await this.accountManager.disable(account, until, cause);
	}

	private static validateOptions<Acc extends AccountModel>(options: AuthenticationEngineOptions<Acc>): AuthenticationEngineOptions<Acc> | never {
		if (options.password.similarity < 0 || options.password.similarity > 1) {
			throw createException(CoreErrorCodes.INVALID, `Password similarity threshold needs to be in range [0, 1]. Given: ${options.password.similarity}.`);
		}

		if (options.tokensLength < 15) {
			throw createException(CoreErrorCodes.NOT_ALLOWED, `Tokens length can't be lower than 15 characters. Given: ${options.tokensLength}.`);
		}

		return options;
	}
}

export { AuthenticationEngine, AuthenticationEngineOptions, AccountToBeRegistered };
