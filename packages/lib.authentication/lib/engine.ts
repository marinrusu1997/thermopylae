import { RequireSome, Seconds, Threshold, UnixTimestamp } from '@thermopylae/core.declarations';

import uidSafe from 'uid-safe';
import { compareTwoStrings } from 'string-similarity';
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
import type { PasswordHashingOptions } from './managers/password';
import type { EmailSender, SmsSender } from './types/side-channels';
import type { AccountModel, FailedAuthenticationModel, SuccessfulAuthenticationModel } from './types/models';
import { ChallengeResponseStep } from './authentication/steps/challenge-response-step';
import type { ChallengeResponseValidator } from './authentication/steps/challenge-response-step';
import { GenerateChallengeStep } from './authentication/steps/generate-challenge-step';
import { AccountManager } from './managers/account';
import type { OnAccountDisabledHook, OnAuthenticationFromDifferentContextHook, OnForgottenPasswordChangedHook, OnPasswordChangedHook } from './types/hooks';
import type { AuthenticationContext, BaseContext, ChangePasswordContext, SetTwoFactorAuthenticationContext } from './types/contexts';
import type { PasswordStrengthPolicyValidator } from './managers/password/strength/policy';
import { SecretEncryptor } from './helpers/secret-encryptor';
import type { SecretEncryptionOptions } from './helpers/secret-encryptor';
import { TwoFactorAuthStrategy } from './authentication/2fa/interface';
import { AuthenticationSessionRepositoryHolder } from './helpers/authentication-session-repository-holder';
import { FailedAuthenticationsManager } from './managers/failed-authentications';
import { TokenManager } from './managers/token';

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

// @fixme compare all tokens using constant time string comparison (e.g. password hashes, some tokens, etc)
// https://snyk.io/blog/node-js-timing-attack-ccc-ctf/ (npm packages can be found in the Summary section)

// @fixme also for tokens, it would be recommended to use HMAC, and secret to be kept outside of the db
// this way if tokens are leaked, they are useless without that secret

/**
 * Minimal fields required for account registration.
 */
type AccountToBeRegistered<Account extends AccountModel> = RequireSome<Partial<Account>, 'username' | 'passwordHash' | 'email' | 'disabledUntil'>;

/**
 * Function which encrypts forgot password token.
 *
 * @param pubKey	Public Key of the user account (see {@link AccountModel.pubKey}).
 * @param token		Forgot password token in plaintext.
 *
 * @returns			Encrypted token.
 */
type EncryptForgotPasswordToken = (pubKey: string, token: string) => Promise<string>;

interface AuthenticationEngineOptions<Account extends AccountModel> {
	/**
	 * Threshold options.
	 */
	readonly thresholds: {
		/**
		 * Number of allowed failed authentication attempts before account will be locked
		 * for {@link AuthenticationEngineOptions.ttl.accountDisableTimeout} seconds.
		 */
		readonly maxFailedAuthAttempts: Threshold;
		/**
		 * Number of failed authentication attempts before recaptcha validation will be performed.
		 */
		readonly failedAuthAttemptsRecaptcha: Threshold;
	};
	/**
	 * Time to live options.
	 */
	readonly ttl: {
		/**
		 * TTL in seconds of the {@link AuthenticationSession}.
		 */
		readonly authenticationSession: Seconds;
		/**
		 * TTL in seconds of the {@link FailedAuthenticationAttemptSession}.
		 */
		readonly failedAuthAttemptsSession: Seconds;
		/**
		 * TTL in seconds of the activate account token.
		 */
		readonly activateAccountSession: Seconds;
		/**
		 * TTL in seconds of the forgot password token.
		 */
		readonly forgotPasswordSession: Seconds;
		/**
		 * Timeout in seconds for which account will be disabled by internal procedures.
		 */
		readonly accountDisableTimeout: Seconds;
	};
	/**
	 * Repositories used by {@link AuthenticationEngine}.
	 */
	readonly repositories: {
		readonly account: AccountRepository<Account>;
		readonly successfulAuthentications: SuccessfulAuthenticationsRepository;
		readonly failedAuthenticationAttempts: FailedAuthenticationAttemptsRepository;
		readonly authenticationSession: AuthenticationSessionRepository;
		readonly failedAuthAttemptSession: FailedAuthAttemptSessionRepository;
		readonly forgotPasswordSession: ForgotPasswordSessionRepository;
		readonly activateAccountSession: ActivateAccountSessionRepository<Account>;
	};
	/**
	 * Hooks called by {@link AuthenticationEngine}.
	 */
	readonly hooks: {
		/**
		 * Hook called when authentication from different context (i.e. different device, location etc.) has been detected.
		 */
		readonly onAuthenticationFromDifferentContext: OnAuthenticationFromDifferentContextHook<Account>;
		/**
		 * Hook called when account has been disabled due to authentication error or explicitly by admin.
		 */
		readonly onAccountDisabled: OnAccountDisabledHook<Account>;
		/**
		 * Hook called when password has been changed.
		 */
		readonly onPasswordChanged: OnPasswordChangedHook<Account>;
		/**
		 * Hook called when forgotten password has been changed.
		 */
		readonly onForgottenPasswordChanged: OnForgottenPasswordChangedHook<Account>;
	};
	readonly validators: {
		readonly recaptcha: RecaptchaValidator;
		readonly challengeResponse?: ChallengeResponseValidator;
	};
	readonly password: {
		readonly hashing: PasswordHashingOptions;
		/**
		 * Password encryption options. <br/>
		 * Depending of this option value, following behaviours will occur: <br/>
		 * - *false* - password hash will be stored in plaintext in the {@link AccountModel.passwordHash} <br/>
		 * - *{@link SecretEncryptionOptions}* - password hash will be encrypted before being stored in the {@link AccountModel.passwordHash}
		 */
		readonly encryption: SecretEncryptionOptions | false;
		/**
		 * Password strength policy validators.
		 */
		readonly strength: PasswordStrengthPolicyValidator<Account>[];
		/**
		 * Password similarity threshold used when password is changed.
		 * When old and new password have a similarity equal or greater with this one,
		 * error will be thrown and password change process will be aborted. <br/>
		 * Ranges between [0, 1], **0** being completely different and **1** being completely similar.
		 */
		readonly similarity: Threshold;
		/**
		 * Forgot password token encryptor.
		 */
		readonly forgotPasswordTokenEncrypt: EncryptForgotPasswordToken;
	};
	readonly email: {
		/**
		 * Email of the administrator.
		 */
		readonly admin: string;
		readonly sender: EmailSender<Account>;
	};
	readonly smsSender: SmsSender<Account>;
	readonly '2fa-strategy': TwoFactorAuthStrategy<Account>;
	/**
	 * Length of the issued tokens (e.g. forgot password token, account activation token etc.). <br/>
	 * Recommended value is 24.
	 */
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
				this.options.hooks.onAuthenticationFromDifferentContext,
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

	public async authenticate(authenticationContext: AuthenticationContext): Promise<AuthenticationStatus<Account>> {
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
			const duplicatedFields = await this.options.repositories.account.insert(account as Account);
			if (duplicatedFields != null) {
				throw createException(
					ErrorCodes.ACCOUNT_WITH_DUPLICATED_FIELDS,
					"Account can't be registered, because it has duplicated fields.",
					duplicatedFields
				);
			}
			return;
		}

		if (account.disabledUntil === AccountStatus.DISABLED_UNTIL_ACTIVATION) {
			const duplicatedFields = await this.options.repositories.account.isDuplicate(account as Account);
			if (duplicatedFields != null) {
				throw createException(
					ErrorCodes.ACCOUNT_WITH_DUPLICATED_FIELDS,
					"Account can't be registered, because it has duplicated fields.",
					duplicatedFields
				);
			}

			const activateToken = await uidSafe(this.options.tokensLength);
			await this.options.repositories.activateAccountSession.insert(activateToken, account as Account, this.options.ttl.activateAccountSession);

			try {
				await this.options.email.sender.sendActivateAccountToken(account as Account, activateToken);
			} catch (e) {
				await this.options.repositories.activateAccountSession.delete(activateToken);
				throw e;
			}

			return;
		}

		throw createException(
			ErrorCodes.INVALID_DISABLED_UNTIL_VALUE,
			`Account 'disabledUntil' field should take either ${AccountStatus.ENABLED} or ${AccountStatus.DISABLED_UNTIL_ACTIVATION} values. Given: ${account.disabledUntil}.`
		);
	}

	public async activateAccount(activateAccountToken: string): Promise<void> {
		const unactivatedAccount = await this.options.repositories.activateAccountSession.read(activateAccountToken);
		if (unactivatedAccount == null) {
			throw createException(ErrorCodes.SESSION_NOT_FOUND, `Activate account session identified by token '${activateAccountToken}' not found.`);
		}

		unactivatedAccount.disabledUntil = AccountStatus.ENABLED;

		const [, duplicatedFields] = await Promise.all([
			this.options.repositories.activateAccountSession.delete(activateAccountToken), // prevent replay
			this.options.repositories.account.insert(unactivatedAccount)
		]);

		if (duplicatedFields != null) {
			throw createException(
				ErrorCodes.ACCOUNT_WITH_DUPLICATED_FIELDS,
				"Account can't be registered, because it has duplicated fields.",
				duplicatedFields
			);
		}
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
		await this.failedAuthenticationsManager.deleteSession(account);

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

		if (compareTwoStrings(changePasswordContext.oldPassword, changePasswordContext.newPassword) >= this.options.password.similarity) {
			throw createException(
				ErrorCodes.SIMILAR_PASSWORDS,
				`Can't change password for account with id ${account.id}, because new password is too similar with the old one.`
			);
		}

		await this.passwordsManager.changeAndStoreOnAccount(changePasswordContext.newPassword, account);
		await this.options.hooks.onPasswordChanged(account, changePasswordContext);

		await this.options.email.sender.notifyPasswordChanged(account, changePasswordContext);
	}

	/**
	 * @fixme When account not found err is thrown, REST API should not respond with error, in order to prevent user enumeration,
	 * i.e it should respond with ok (something like token was sent to specified email, even if account doesn't exist)
	 *
	 * @param accountUniqueFieldName
	 * @param accountUniqueFieldValue
	 * @param sideChannel
	 */
	public async createForgotPasswordSession(
		accountUniqueFieldName: `readBy${Capitalize<Extract<keyof Account, 'username' | 'email' | 'telephone'>>}`,
		accountUniqueFieldValue: string,
		sideChannel: 'email' | 'sms'
	): Promise<Account> {
		const account = await this.accountManager[accountUniqueFieldName](accountUniqueFieldValue);

		const sessionToken = await this.tokenManager.issueEncodedWithAccountId(account.id);
		await this.options.repositories.forgotPasswordSession.insert(sessionToken, this.options.ttl.forgotPasswordSession);

		try {
			if (sideChannel === 'email') {
				await this.options.email.sender.sendForgotPasswordToken(
					account,
					account.pubKey ? await this.options.password.forgotPasswordTokenEncrypt(account.pubKey, sessionToken) : sessionToken
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
					account.pubKey ? await this.options.password.forgotPasswordTokenEncrypt(account.pubKey, sessionToken) : sessionToken
				);
			} else {
				throw createException(
					ErrorCodes.UNKNOWN_CREATE_FORGOT_PASSWORD_SESSION_SIDE_CHANNEL,
					`Can't send forgot password token for account with id '${account.id}', because side channel type '${sideChannel}' is unknown.`
				);
			}

			return account;
		} catch (e) {
			await this.options.repositories.forgotPasswordSession.delete(sessionToken);
			throw e;
		}
	}

	public async changeForgottenPassword(token: string, newPassword: string): Promise<void> {
		if (!(await this.options.repositories.forgotPasswordSession.exists(token))) {
			throw createException(ErrorCodes.SESSION_NOT_FOUND, `Forgot password session identified by token '${token}' doesn't exist.`);
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
			throw createException(
				ErrorCodes.INVALID_PASSWORD_SIMILARITY_VALUE,
				`Password similarity threshold needs to be in range [0, 1]. Given: ${options.password.similarity}.`
			);
		}

		if (options.tokensLength < 15) {
			throw createException(ErrorCodes.INVALID_TOKENS_LENGTH, `Tokens length can't be lower than 15 characters. Given: ${options.tokensLength}.`);
		}

		return options;
	}
}

export { AuthenticationEngine, AuthenticationEngineOptions, AccountToBeRegistered };
