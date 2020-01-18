import { chrono, token, totp } from '@marin/lib.utils';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SMS } from '@marin/lib.sms';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IIssuedJWTPayload, Jwt } from '@marin/lib.jwt';

import {
	AuthRequest,
	RegistrationRequest,
	ChangeForgottenPasswordRequest,
	ChangePasswordRequest,
	CreateForgotPasswordSessionRequest,
	SIDE_CHANNEL
} from './types/requests';
import { BasicCredentials } from './types/basic-types';
import { AuthStatus } from './authentication/auth-step';
import {
	AccessPointEntity,
	AccountEntity,
	ActivateAccountSessionEntity,
	ActiveUserSessionEntity,
	AuthSessionEntity,
	FailedAuthAttemptsEntity,
	FailedAuthAttemptSessionEntity,
	ForgotPasswordSessionEntity
} from './types/entities';
import { createException, ErrorCodes } from './error';
import { AuthOrchestrator } from './authentication/auth-orchestrator';
import { AUTH_STEP } from './types/enums';
import { DispatchStep } from './authentication/steps/dispatch-step';
import { PasswordStep } from './authentication/steps/password-step';
import { TotpStep } from './authentication/steps/totp-step';
import { GenerateTotpStep } from './authentication/steps/generate-totp-step';
import { RecaptchaStep, RecaptchaValidator } from './authentication/steps/recaptcha-step';
import { ErrorStep } from './authentication/steps/error-step';
import { UserSessionsManager } from './managers/user-sessions-manager';
import { AccountLockingManager } from './managers/account-locking-manager';
import { AuthenticatedStep } from './authentication/steps/authenticated-step';
import { PasswordsManager } from './managers/passwords-manager';
import {
	// eslint-disable-next-line import/named
	ActivateAccountTemplate,
	// eslint-disable-next-line import/named
	ForgotPasswordTemplate,
	NotificationAccountLockedTemplate,
	NotificationAuthFromDiffDeviceTemplate,
	NotificationMFAFailedTemplate,
	sendActivateAccountLinkToUserEmail,
	// eslint-disable-next-line import/named
	sendForgotPasswordTokenToUserEmail
} from './email';
import { ActiveUserSession } from './types/sessions';
import { AccessPointModel, FailedAuthAttemptsModel } from './types/models';
import { CancelScheduledUnactivatedAccountDeletion, ScheduleActiveUserSessionDeletion, ScheduleUnactivatedAccountDeletion } from './types/schedulers';
import { getLogger } from './logger';
import { ChallengeResponseStep, ChallengeResponseValidator } from './authentication/steps/challenge-response-step';
import { GenerateChallengeStep } from './authentication/steps/generate-challenge-step';

class AuthenticationEngine {
	private readonly config: InternalUsageOptions;
	private readonly authOrchestrator: AuthOrchestrator;
	private readonly totpManager: totp.Totp;
	private readonly userSessionsManager: UserSessionsManager;
	private readonly passwordsManager: PasswordsManager;
	private readonly accountLocker: AccountLockingManager;

	constructor(options: AuthEngineOptions) {
		this.config = fillWithDefaults(options);
		this.totpManager = new totp.Totp({ ttl: this.config.ttl.totp, secret: this.config.secrets.totp });
		this.userSessionsManager = new UserSessionsManager(
			this.config.schedulers.deleteActiveUserSession,
			this.config.jwt.instance,
			this.config.entities.activeUserSession,
			this.config.entities.accessPoint,
			this.config.jwt.rolesTtl
		);
		this.passwordsManager = new PasswordsManager(this.config.thresholds.passwordBreach, this.config.entities.account);
		this.accountLocker = new AccountLockingManager(
			this.config.entities.account,
			this.userSessionsManager,
			this.config['side-channels'].email,
			this.config.templates.accountLocked
		);

		this.authOrchestrator = new AuthOrchestrator();
		this.authOrchestrator.register(AUTH_STEP.DISPATCH, new DispatchStep());
		this.authOrchestrator.register(AUTH_STEP.PASSWORD, new PasswordStep(this.config.secrets.pepper));
		this.authOrchestrator.register(
			AUTH_STEP.GENERATE_TOTP,
			new GenerateTotpStep(this.totpManager, this.config['side-channels'].sms, this.config.templates.totpTokenSms)
		);
		this.authOrchestrator.register(
			AUTH_STEP.TOTP,
			new TotpStep(this.totpManager, this.config['side-channels'].email, this.config.templates.multiFactorAuthFailed)
		);
		this.authOrchestrator.register(AUTH_STEP.RECAPTCHA, new RecaptchaStep(this.config.validators.recaptcha));
		this.authOrchestrator.register(
			AUTH_STEP.ERROR,
			new ErrorStep(
				this.config.contacts.adminEmail,
				this.config.thresholds.maxFailedAuthAttempts,
				this.config.thresholds.recaptcha,
				this.config.ttl.failedAuthAttemptsSession,
				this.config.entities.failedAuthAttemptsSession,
				this.config.entities.failedAuthAttempts,
				this.accountLocker
			)
		);
		this.authOrchestrator.register(
			AUTH_STEP.AUTHENTICATED,
			new AuthenticatedStep(
				this.config['side-channels'].email,
				this.config.templates.authFromDiffDevice,
				this.userSessionsManager,
				this.config.entities.accessPoint,
				this.config.entities.failedAuthAttemptsSession
			)
		);
		if (this.config.validators.challengeResponse) {
			this.authOrchestrator.register(AUTH_STEP.GENERATE_CHALLENGE, new GenerateChallengeStep(this.config.sizes.token));
			this.authOrchestrator.register(AUTH_STEP.CHALLENGE_RESPONSE, new ChallengeResponseStep(this.config.validators.challengeResponse));
		}
	}

	/**
	 * @access public
	 */
	public async authenticate(authRequest: AuthRequest): Promise<AuthStatus> {
		const account = await this.config.entities.account.read(authRequest.username);

		if (!account) {
			throw createException(ErrorCodes.NOT_FOUND, `Account ${authRequest.username} not found.`);
		}

		if (account.locked) {
			throw createException(ErrorCodes.ACCOUNT_IS_LOCKED, `Account ${account.username} is locked.`);
		}
		if (!account.activated) {
			throw createException(ErrorCodes.CHECKING_FAILED, `Account ${account.username} is not activated.`);
		}

		// auth session is based and on device too, in order to prevent collisions with other auth sessions which may take place simultaneously
		let authSession = await this.config.entities.authSession.read(authRequest.username, authRequest.device);
		if (!authSession) {
			authSession = await this.config.entities.authSession.create(authRequest.username, authRequest.device, this.config.ttl.authSession);
		}

		const result = await this.authOrchestrator.authenticate(authRequest, account, authSession);

		if (result.nextStep) {
			// will be reused on auth continuation from previous step
			await this.config.entities.authSession.update(authRequest.username, authRequest.device, authSession);
		} else {
			// on success or hard error not needed anymore
			await this.config.entities.authSession.delete(authRequest.username, authRequest.device);
		}

		return result;
	}

	/**
	 * @access public
	 */
	public async register(registrationInfo: RegistrationRequest, options?: Partial<RegistrationOptions>): Promise<string> {
		options = options || {};
		options.useMultiFactorAuth = (options && options.useMultiFactorAuth) || false;
		options.isActivated = (options && options.isActivated) || false;

		const account = await this.config.entities.account.read(registrationInfo.username);
		if (account) {
			throw createException(ErrorCodes.ALREADY_REGISTERED, `Account ${registrationInfo.username} is registered already.`);
		}

		await this.passwordsManager.validateStrengthness(registrationInfo.password);
		const salt = await PasswordsManager.generateSalt(this.config.sizes.salt);
		const passwordHash = await PasswordsManager.hash(registrationInfo.password, salt, this.config.secrets.pepper);
		const registeredAccount = await this.config.entities.account.create({
			username: registrationInfo.username,
			password: passwordHash,
			salt,
			telephone: registrationInfo.telephone,
			email: registrationInfo.email,
			role: registrationInfo.role,
			locked: false,
			activated: options.isActivated,
			mfa: options.useMultiFactorAuth,
			pubKey: registrationInfo.pubKey
		});

		if (!options.isActivated) {
			let activateToken: any;
			let deleteAccountTaskId;
			let activateAccountSessionWasCreated = false;
			try {
				activateToken = await token.generateToken(this.config.sizes.token);
				deleteAccountTaskId = await this.config.schedulers.account.deleteUnactivated(
					registeredAccount.id!,
					chrono.dateFromSeconds(chrono.nowInSeconds() + chrono.minutesToSeconds(this.config.ttl.activateAccountSession))
				);
				await this.config.entities.activateAccountSession.create(
					activateToken.plain,
					{ accountId: registeredAccount.id!, taskId: deleteAccountTaskId },
					this.config.ttl.activateAccountSession
				);
				activateAccountSessionWasCreated = true;
				await sendActivateAccountLinkToUserEmail(
					this.config.templates.activateAccount,
					this.config['side-channels'].email,
					registeredAccount.email,
					activateToken.plain
				);
			} catch (e) {
				if (deleteAccountTaskId) {
					// in future it's a very very small chance to id collision, so this task may delete account of the other valid user
					await this.config.schedulers.account.cancelDelete(deleteAccountTaskId); // task cancelling is not allowed to throw
				}
				await this.config.entities.account.delete(registeredAccount.id!);
				if (activateAccountSessionWasCreated) {
					await this.config.entities.activateAccountSession.delete(activateToken.plain);
				}
				throw e;
			}
		}

		return registeredAccount.id!;
	}

	/**
	 * @access public
	 */
	public async activateAccount(activateAccountToken: string): Promise<void> {
		const session = await this.config.entities.activateAccountSession.read(activateAccountToken);
		if (!session) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, 'Provided token is not valid');
		}
		await Promise.all([
			this.config.entities.account.activate(session.accountId),
			this.config.schedulers.account.cancelDelete(session.taskId),
			this.config.entities.activateAccountSession
				.delete(activateAccountToken)
				.catch(err =>
					getLogger().error(
						`Failed to delete activate account session with id ${activateAccountToken} for account with id ${session.accountId}. `,
						err
					)
				)
		]);
	}

	/**
	 * @access private
	 */
	public activateMultiFactorAuthentication(accountId: string, activate: boolean): Promise<void> {
		return this.config.entities.account.activateMFA(accountId, activate);
	}

	/**
	 * @access private
	 */
	public getActiveSessions(accountId: string): Promise<Array<ActiveUserSession & AccessPointModel>> {
		return this.userSessionsManager.read(accountId);
	}

	/**
	 * @access private
	 */
	public getFailedAuthAttempts(accountId: string, startingFrom?: number, endingTo?: number): Promise<Array<FailedAuthAttemptsModel>> {
		return this.config.entities.failedAuthAttempts.readRange(accountId, startingFrom, endingTo);
	}

	/**
	 * @access private
	 */
	public async changePassword(changePasswordRequest: ChangePasswordRequest): Promise<number> {
		const account = await this.config.entities.account.readById(changePasswordRequest.accountId);
		if (!account) {
			throw createException(ErrorCodes.NOT_FOUND, `Account with id ${changePasswordRequest.accountId} not found.`);
		}
		if (account.locked) {
			// just in case session invalidation failed when account was locked
			throw createException(ErrorCodes.ACCOUNT_IS_LOCKED, `Account with id ${changePasswordRequest.accountId} is locked.`);
		}
		if (!(await PasswordsManager.isCorrect(changePasswordRequest.oldPassword, account.password, account.salt, this.config.secrets.pepper))) {
			throw createException(ErrorCodes.INVALID_PASSWORD, "Old passwords doesn't match.");
		}
		// additional checks are not made, as we rely on authenticate step, e.g. for locked accounts all sessions are invalidated

		await this.passwordsManager.change(
			changePasswordRequest.accountId,
			changePasswordRequest.newPassword,
			this.config.sizes.salt,
			this.config.secrets.pepper
		);

		// logout from all devices, needs to be be done, as usually jwt will be long lived
		return this.userSessionsManager.deleteAllButCurrent(account.id!, account.role, changePasswordRequest.sessionId);
	}

	/**
	 * @access public
	 */
	public async createForgotPasswordSession(forgotPasswordRequest: CreateForgotPasswordSessionRequest): Promise<void> {
		const account = await this.config.entities.account.read(forgotPasswordRequest.username);
		if (!account) {
			// silently discard invalid username, in order to prevent user enumeration
			return;
		}

		const sessionToken = await token.generateToken(this.config.sizes.token);
		await this.config.entities.forgotPasswordSession.create(
			sessionToken.plain,
			{ accountId: account.id!, accountRole: account.role },
			this.config.ttl.forgotPasswordSession
		);

		try {
			switch (forgotPasswordRequest['side-channel']) {
				case SIDE_CHANNEL.EMAIL:
					await sendForgotPasswordTokenToUserEmail(
						this.config.templates.forgotPasswordTokenEmail,
						this.config['side-channels'].email,
						account.email,
						sessionToken.plain
					);
					break;
				case SIDE_CHANNEL.SMS:
					await this.config['side-channels'].sms.send(account.telephone, this.config.templates.forgotPasswordTokenSms(sessionToken.plain));
					break;
				default:
					throw new Error('Unknown side channel');
			}
		} catch (err) {
			getLogger().error(`Failed to send forgot password token for account ${account.id}. Deleting session with id ${sessionToken}. `, err);
			await this.config.entities.forgotPasswordSession.delete(sessionToken.plain);
			throw err;
		}
	}

	/**
	 * @access public
	 */
	public async changeForgottenPassword(changeForgottenPasswordRequest: ChangeForgottenPasswordRequest): Promise<void> {
		const forgotPasswordSession = await this.config.entities.forgotPasswordSession.read(changeForgottenPasswordRequest.token);
		if (!forgotPasswordSession) {
			throw createException(ErrorCodes.INVALID_ARGUMENT, `Invalid forgot password token ${changeForgottenPasswordRequest.token}`);
		}
		await this.passwordsManager.change(
			forgotPasswordSession.accountId,
			changeForgottenPasswordRequest.newPassword,
			this.config.sizes.salt,
			this.config.secrets.pepper
		);

		// operation is considered successful, even if some of the clean up steps fails
		try {
			await this.config.entities.forgotPasswordSession.delete(changeForgottenPasswordRequest.token);
			await this.logoutFromAllDevices({ sub: forgotPasswordSession.accountId, aud: forgotPasswordSession.accountRole });
		} catch (error) {
			getLogger().error(`Failed to clean up forgot password session for account ${forgotPasswordSession.accountId}. `, error);
		}
	}

	/**
	 * @access internal
	 */
	public async areAccountCredentialsValid(accountId: string, credentials: BasicCredentials): Promise<boolean> {
		const account = await this.config.entities.account.readById(accountId);
		if (!account) {
			throw createException(ErrorCodes.NOT_FOUND, `Account with id ${accountId} not found.`);
		}
		if (!(credentials.username === account.username)) {
			return false;
		}
		return PasswordsManager.isCorrect(credentials.password, account.password, account.salt, this.config.secrets.pepper);
	}

	/**
	 * @access private by admins only
	 */
	public async lockAccount(accountId: string, cause: string): Promise<void> {
		const account = await this.config.entities.account.readById(accountId);
		if (!account) {
			throw createException(ErrorCodes.NOT_FOUND, `Account with id ${accountId} not found.`);
		}
		return this.accountLocker.lock(account, this.config.contacts.adminEmail, cause);
	}

	/**
	 * @access private by admins only
	 */
	public unlockAccount(accountId: string): Promise<void> {
		return this.accountLocker.unlock(accountId);
	}

	/**
	 * @access private
	 */
	public async logout(payload: IIssuedJWTPayload): Promise<void> {
		return this.userSessionsManager.delete(payload);
	}

	/**
	 * @access private
	 */
	public logoutFromAllDevices(payload: { sub: string; aud?: string }): Promise<number> {
		return this.userSessionsManager.deleteAll(payload.sub, payload.aud);
	}

	/**
	 * @access private
	 */
	public logoutFromAllDevicesExceptFromCurrent(accountId: string, sessionId: number): Promise<number> {
		return this.config.entities.account.readById(accountId).then(account => {
			if (!account) {
				throw createException(ErrorCodes.NOT_FOUND, `Account with id ${accountId} not found.`);
			}
			return this.userSessionsManager.deleteAllButCurrent(account.id!, account.role, sessionId);
		});
	}
}

interface TTLOptions {
	authSession?: number; // minutes
	failedAuthAttemptsSession?: number; // minutes
	activateAccountSession?: number; // minutes
	forgotPasswordSession?: number; // minutes
	totp?: number; // seconds
}

interface ThresholdsOptions {
	maxFailedAuthAttempts?: number;
	recaptcha?: number;
	passwordBreach?: number;
}

interface SizesOptions {
	salt?: number; // bytes
	token?: number; // bytes
}

interface AuthEngineOptions {
	jwt: {
		instance: Jwt;
		rolesTtl?: Map<string, number>; // role -> seconds
	};
	entities: {
		account: AccountEntity;
		activeUserSession: ActiveUserSessionEntity;
		authSession: AuthSessionEntity;
		accessPoint: AccessPointEntity;
		failedAuthAttemptsSession: FailedAuthAttemptSessionEntity;
		failedAuthAttempts: FailedAuthAttemptsEntity;
		activateAccountSession: ActivateAccountSessionEntity;
		forgotPasswordSession: ForgotPasswordSessionEntity;
	};
	'side-channels': {
		email: Email;
		sms: SMS;
	};
	templates: {
		totpTokenSms: (totp: string) => string;
		multiFactorAuthFailed: NotificationMFAFailedTemplate;
		accountLocked: NotificationAccountLockedTemplate;
		authFromDiffDevice: NotificationAuthFromDiffDeviceTemplate;
		activateAccount: ActivateAccountTemplate;
		forgotPasswordTokenSms: (token: string) => string;
		forgotPasswordTokenEmail: ForgotPasswordTemplate;
	};
	schedulers: {
		deleteActiveUserSession: ScheduleActiveUserSessionDeletion;
		account: {
			deleteUnactivated: ScheduleUnactivatedAccountDeletion;
			cancelDelete: CancelScheduledUnactivatedAccountDeletion;
		};
	};
	validators: {
		recaptcha: RecaptchaValidator;
		challengeResponse?: ChallengeResponseValidator;
	};
	ttl?: TTLOptions;
	thresholds?: ThresholdsOptions;
	sizes?: SizesOptions;
	secrets: {
		pepper: string;
		totp: string;
	};
	contacts: {
		adminEmail: string;
	};
}

interface RegistrationOptions {
	useMultiFactorAuth: boolean;
	isActivated: boolean; // based on user role, account can be activated or not at the registration time
}

type InternalUsageOptions = Required<
	AuthEngineOptions & { ttl: Required<TTLOptions> } & { thresholds: Required<ThresholdsOptions> } & { sizes: Required<SizesOptions> }
>;

function fillWithDefaults(options: AuthEngineOptions): Required<InternalUsageOptions> {
	options.ttl = options.ttl || {};
	options.thresholds = options.thresholds || {};
	options.sizes = options.sizes || {};
	return {
		jwt: options.jwt,
		entities: options.entities,
		ttl: {
			authSession: options.ttl.authSession || 2, // minutes, this needs to be as short as possible
			failedAuthAttemptsSession: options.ttl.failedAuthAttemptsSession || 5, // minutes,
			activateAccountSession: options.ttl.activateAccountSession || 60, // minutes
			forgotPasswordSession: options.ttl.forgotPasswordSession || 5, // minutes
			totp: options.ttl.totp || 30 // seconds
		},
		thresholds: {
			maxFailedAuthAttempts: options.thresholds.maxFailedAuthAttempts || 20,
			recaptcha: options.thresholds.recaptcha || 10,
			passwordBreach: options.thresholds.passwordBreach || 5
		},
		sizes: {
			salt: options.sizes.salt || 10,
			token: options.sizes.token || 20
		},
		secrets: options.secrets,
		templates: options.templates,
		contacts: options.contacts,
		'side-channels': options['side-channels'],
		schedulers: options.schedulers,
		validators: options.validators
	};
}

// eslint-disable-next-line no-undef
export { AuthenticationEngine, AuthEngineOptions };
