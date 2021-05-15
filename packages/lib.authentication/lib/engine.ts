import { chrono, totp } from '@thermopylae/lib.utils';
import { ErrorCodes as CoreErrorCodes } from '@thermopylae/core.declarations';
import uidSafe from 'uid-safe';

import {
	AuthRequest,
	ChangeForgottenPasswordRequest,
	ChangePasswordRequest,
	CreateForgotPasswordSessionRequest,
	RegistrationRequest,
	SIDE_CHANNEL
} from './types/requests';
import { BasicCredentials } from './types/basic-types';
import { AuthStatus } from './authentication/auth-step';
import {
	AuthenticationEntryPointEntity,
	AccountEntity,
	ActivateAccountSessionEntity,
	ActiveUserSessionEntity,
	AuthSessionEntity,
	FailedAuthenticationAttemptsEntity,
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
import { AuthenticatedStep } from './authentication/steps/authenticated-step';
import { PasswordsManager, PasswordHasherInterface, PasswordHash } from './managers/passwords-manager';
import { EmailSender, SmsSender } from './side-channels';
import { AccountModel, FailedAuthAttemptsModel } from './types/models';
import {
	CancelScheduledUnactivatedAccountDeletion,
	ScheduleAccountEnabling,
	ScheduleActiveUserSessionDeletion,
	ScheduleUnactivatedAccountDeletion
} from './types/schedulers';
import { ChallengeResponseStep, ChallengeResponseValidator } from './authentication/steps/challenge-response-step';
import { GenerateChallengeStep } from './authentication/steps/generate-challenge-step';
import { AccountStatusManager } from './managers/account-status-manager';
import { logger } from './logger';

// @fixme implement something like password confirmation, like when deleting repo on github,
//	it requires from user his password, validate it, and then perform action,
//	notice that on further actions of same kind, password is no longer needed (i think client stores some token from backend)

// @fixme minimize as much as possible number of interactions between app and DB/Redis

// @fixme add support for google otp generator from mobile device

// @fixme add suport for forcefull change of password once in 3 months

// @fixme add suport to detect that new password is not identic (or almost identic) with old one

// @fixme please review this https://www.youtube.com/watch?v=5rjjCZmbB6c before refactoring

// @fixme  Security questions are no longer recognized as an acceptable authentication factor per NIST SP 800-63. they have nothing to do here

class AuthenticationEngine {
	private static readonly ALLOWED_SIDE_CHANNELS = [SIDE_CHANNEL.EMAIL, SIDE_CHANNEL.SMS];

	private readonly config: InternalUsageOptions;

	private readonly accountStatusManager: AccountStatusManager;

	private readonly authOrchestrator: AuthOrchestrator;

	private readonly totpManager: totp.Totp;

	private readonly passwordsManager: PasswordsManager;

	public constructor(options: AuthEngineOptions) {
		this.config = fillWithDefaults(options);

		this.totpManager = new totp.Totp({ ttl: this.config.ttl.totpSeconds, secret: this.config.secrets.totp });

		this.accountStatusManager = new AccountStatusManager(
			this.config.contacts.adminEmail,
			this.config.thresholds.enableAccountAfterAuthFailureDelayMinutes,
			this.config['side-channels'].email,
			this.config.entities.account,
			this.config.schedulers.account.enable
		);

		this.passwordsManager = new PasswordsManager(this.config.thresholds.passwordBreach, this.config.entities.account, this.config.passwordHasher);

		this.authOrchestrator = new AuthOrchestrator();
		this.authOrchestrator.register(AUTH_STEP.DISPATCH, new DispatchStep());
		this.authOrchestrator.register(AUTH_STEP.PASSWORD, new PasswordStep(this.passwordsManager));
		this.authOrchestrator.register(AUTH_STEP.GENERATE_TOTP, new GenerateTotpStep(this.config['side-channels'].sms, this.totpManager));
		this.authOrchestrator.register(AUTH_STEP.TOTP, new TotpStep(this.config['side-channels'].email, this.totpManager));
		this.authOrchestrator.register(AUTH_STEP.RECAPTCHA, new RecaptchaStep(this.config.validators.recaptcha));
		this.authOrchestrator.register(
			AUTH_STEP.ERROR,
			new ErrorStep(
				this.config.thresholds.maxFailedAuthAttempts,
				this.config.thresholds.recaptcha,
				this.config.ttl.failedAuthAttemptsSessionMinutes,
				this.accountStatusManager,
				this.config.entities.failedAuthAttemptsSession,
				this.config.entities.failedAuthAttempts
			)
		);
		this.authOrchestrator.register(
			AUTH_STEP.AUTHENTICATED,
			new AuthenticatedStep(this.config['side-channels'].email, this.config.entities.accessPoint, this.config.entities.failedAuthAttemptsSession)
		);
		if (this.config.validators.challengeResponse) {
			this.authOrchestrator.register(AUTH_STEP.GENERATE_CHALLENGE, new GenerateChallengeStep(this.config.tokensLength));
			this.authOrchestrator.register(AUTH_STEP.CHALLENGE_RESPONSE, new ChallengeResponseStep(this.config.validators.challengeResponse));
		}
	}

	public async authenticate(authRequest: AuthRequest): Promise<AuthStatus> {
		const account = await this.config.entities.account.read(authRequest.username);

		if (!account) {
			return { error: { hard: createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account ${authRequest.username} not found. `) } };
		}

		if (!account.enabled) {
			return { error: { hard: createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled. `) } };
		}

		// auth session is based and on device too, in order to prevent collisions with other auth sessions which may take place simultaneously
		let onGoingAuthSession = await this.config.entities.onGoingAuthSession.read(authRequest.username, authRequest.device);
		if (!onGoingAuthSession) {
			onGoingAuthSession = {
				recaptchaRequired: false
			};
			await this.config.entities.onGoingAuthSession.create(
				authRequest.username,
				authRequest.device,
				onGoingAuthSession,
				this.config.ttl.authSessionMinutes
			);
		}

		const result = await this.authOrchestrator.authenticate(authRequest, account, onGoingAuthSession);

		if (result.nextStep) {
			// will be reused on auth continuation from previous step
			await this.config.entities.onGoingAuthSession.update(authRequest.username, authRequest.device, onGoingAuthSession);
		} else {
			// on success or hard error not needed anymore
			await this.config.entities.onGoingAuthSession.delete(authRequest.username, authRequest.device);
		}

		return result;
	}

	public async register(registrationInfo: RegistrationRequest, options?: Partial<RegistrationOptions>): Promise<string> {
		options = options || {};
		options.enableMultiFactorAuth = (options && options.enableMultiFactorAuth) || false;
		options.enabled = (options && options.enabled) || false;

		const account = await this.config.entities.account.read(registrationInfo.username);
		if (account) {
			throw createException(ErrorCodes.ACCOUNT_ALREADY_REGISTERED, `Account ${registrationInfo.username} is registered already.`);
		}

		await this.passwordsManager.validateStrengthness(registrationInfo.password);
		const passwordHash = await this.passwordsManager.hash(registrationInfo.password);
		const registeredAccount: AccountModel = {
			username: registrationInfo.username,
			password: passwordHash.hash,
			hashingAlg: passwordHash.alg,
			salt: passwordHash.salt,
			telephone: registrationInfo.telephone, // @fixme templates
			email: registrationInfo.email,
			role: registrationInfo.role,
			enabled: options.enabled,
			usingMfa: options.enableMultiFactorAuth,
			pubKey: registrationInfo.pubKey
		};
		registeredAccount.id = await this.config.entities.account.create(registeredAccount);

		if (!options.enabled) {
			let activateToken: string;
			let deleteAccountTaskId;
			let activateAccountSessionWasCreated = false;
			try {
				activateToken = await uidSafe(this.config.tokensLength);
				deleteAccountTaskId = await this.config.schedulers.account.deleteUnactivated(
					registeredAccount.id,
					chrono.fromUnixTime(chrono.unixTime() + chrono.minutesToSeconds(this.config.ttl.activateAccountSessionMinutes))
				);
				await this.config.entities.activateAccountSession.create(
					activateToken,
					{ accountId: registeredAccount.id, taskId: deleteAccountTaskId },
					this.config.ttl.activateAccountSessionMinutes
				);
				activateAccountSessionWasCreated = true;
				await this.config['side-channels'].email.sendActivateAccountLink(registeredAccount.email, activateToken);
			} catch (e) {
				if (deleteAccountTaskId) {
					// in future it's a very very small chance to id collision, so this task may scheduleDeletion account of the other valid user
					await this.config.schedulers.account.cancelDeleteUnactivated(deleteAccountTaskId); // task cancelling is not allowed to throw
				}
				await this.config.entities.account.delete(registeredAccount.id);
				if (activateAccountSessionWasCreated) {
					await this.config.entities.activateAccountSession.delete(activateToken!);
				}
				throw e;
			}
		}

		return registeredAccount.id;
	}

	public async activateAccount(activateAccountToken: string): Promise<void> {
		const session = await this.config.entities.activateAccountSession.read(activateAccountToken);
		if (!session) {
			throw createException(ErrorCodes.SESSION_NOT_FOUND, `Activate account session identified by provided token ${activateAccountToken} not found. `);
		}

		// it's pointless to activate users account if canceling it's scheduled deletion fails
		await this.config.schedulers.account.cancelDeleteUnactivated(session.taskId);

		await Promise.all([
			this.config.entities.account.enable(session.accountId),
			this.config.entities.activateAccountSession
				.delete(activateAccountToken)
				.catch((err) =>
					logger.error(`Failed to delete activate account session with id ${activateAccountToken} for account with id ${session.accountId}. `, err)
				)
		]);
	}

	public enableMultiFactorAuthentication(accountId: string): Promise<void> {
		return this.config.entities.account.enableMultiFactorAuth(accountId);
	}

	public disableMultiFactorAuthentication(accountId: string): Promise<void> {
		return this.config.entities.account.disableMultiFactorAuth(accountId);
	}

	public getFailedAuthAttempts(accountId: string, startingFrom?: Date, endingTo?: Date): Promise<Array<FailedAuthAttemptsModel>> {
		return this.config.entities.failedAuthAttempts.readRange(accountId, startingFrom, endingTo);
	}

	public async changePassword(changePasswordRequest: ChangePasswordRequest): Promise<void> {
		const account = await this.config.entities.account.readById(changePasswordRequest.accountId);

		if (!account) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id ${changePasswordRequest.accountId} not found. `);
		}
		if (!account.enabled) {
			// just in case session invalidation failed when account was disabled
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${changePasswordRequest.accountId} is disabled. `);
		}

		const passwordHash = {
			hash: account.password,
			salt: account.salt,
			alg: account.hashingAlg
		};

		if (!(await this.passwordsManager.isSame(changePasswordRequest.old, passwordHash))) {
			throw createException(ErrorCodes.INCORRECT_PASSWORD, "Old passwords doesn't match. ");
		}

		// now that we know that old password is correct, we can safely check for equality with the new one
		if (changePasswordRequest.old === changePasswordRequest.new) {
			throw createException(ErrorCodes.SAME_PASSWORD, 'New password is same as the old one. ');
		}

		// additional checks are not made, as we rely on authenticate step, e.g. for disabled accounts all sessions are invalidated

		await this.passwordsManager.change(changePasswordRequest.accountId, changePasswordRequest.new);

		if (typeof changePasswordRequest.logAllOtherSessionsOut !== 'boolean') {
			// by default logout from all devices, needs to be be done, as usually jwt will be long lived
			changePasswordRequest.logAllOtherSessionsOut = true;
		}

		if (changePasswordRequest.logAllOtherSessionsOut) {
			return this.userSessionsManager.deleteAllButCurrent(account.id!, account.role, changePasswordRequest.sessionId);
		}
	}

	public async createForgotPasswordSession(forgotPasswordRequest: CreateForgotPasswordSessionRequest): Promise<void> {
		if (!AuthenticationEngine.ALLOWED_SIDE_CHANNELS.includes(forgotPasswordRequest['side-channel'])) {
			const errMsg = `Side-Channel ${
				forgotPasswordRequest['side-channel']
			} is UNKNOWN. Allowed side-channels are: ${AuthenticationEngine.ALLOWED_SIDE_CHANNELS.join(', ')}`;
			throw createException(CoreErrorCodes.UNKNOWN, errMsg);
		}

		const account = await this.config.entities.account.read(forgotPasswordRequest.username);
		if (!account) {
			// silently discard invalid username, in order to prevent user enumeration
			return;
		}

		if (!account.enabled) {
			// it's pointless to use forgot password sequence for a disabled account
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled. `);
		}

		const sessionToken = await uidSafe(this.config.tokensLength);
		await this.config.entities.forgotPasswordSession.create(
			sessionToken,
			{ accountId: account.id!, accountRole: account.role },
			this.config.ttl.forgotPasswordSessionMinutes
		);

		try {
			// WE HAVE CHECKED THEM AT THE METHOD START!!!
			// eslint-disable-next-line default-case
			switch (forgotPasswordRequest['side-channel']) {
				case SIDE_CHANNEL.EMAIL:
					await this.config['side-channels'].email.sendForgotPasswordToken(account.email, sessionToken);
					break;
				case SIDE_CHANNEL.SMS:
					await this.config['side-channels'].sms.sendForgotPasswordToken(account.telephone, sessionToken);
					break;
			}
		} catch (err) {
			logger.error(`Failed to send forgot password token for account ${account.id}. Deleting session with id ${sessionToken}. `, err);
			await this.config.entities.forgotPasswordSession.delete(sessionToken);
			throw err;
		}
	}

	public async changeForgottenPassword(changeForgottenPasswordRequest: ChangeForgottenPasswordRequest): Promise<void> {
		const forgotPasswordSession = await this.config.entities.forgotPasswordSession.read(changeForgottenPasswordRequest.token);
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
			await this.config.entities.forgotPasswordSession.delete(changeForgottenPasswordRequest.token);
			await this.logoutFromAllDevices({ sub: forgotPasswordSession.accountId, aud: forgotPasswordSession.accountRole });
		} catch (error) {
			// operation is considered successful, even if some of the clean up steps fails
			logger.error(`Failed to clean up forgot password session for account ${forgotPasswordSession.accountId}. `, error);
		}
	}

	public async areAccountCredentialsValid(accountId: string, credentials: BasicCredentials): Promise<boolean> {
		const account = await this.config.entities.account.readById(accountId);

		if (!account) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id ${accountId} not found. `);
		}

		if (!account.enabled) {
			// disabled account can't be used in order to invoke other operations
			throw createException(ErrorCodes.ACCOUNT_DISABLED, `Account with id ${account.id} is disabled. `);
		}

		if (!(credentials.username === account.username)) {
			return false;
		}

		const passwordHash = {
			hash: account.password,
			salt: account.salt,
			alg: account.hashingAlg
		};

		return this.passwordsManager.isSame(credentials.password, passwordHash);
	}

	public async enableAccount(accountId: string): Promise<void> {
		await this.accountStatusManager.enable(accountId);
	}

	public async disableAccount(accountId: string, cause: string): Promise<void> {
		const account = await this.config.entities.account.readById(accountId);
		if (!account) {
			throw createException(ErrorCodes.ACCOUNT_NOT_FOUND, `Account with id ${accountId} not found. `);
		}
		await this.accountStatusManager.disable(account, cause);
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

interface AuthEngineOptions {
	entities: {
		account: AccountEntity;
		activeUserSession: ActiveUserSessionEntity;
		onGoingAuthSession: AuthSessionEntity;
		accessPoint: AuthenticationEntryPointEntity;
		failedAuthAttemptsSession: FailedAuthAttemptSessionEntity;
		failedAuthAttempts: FailedAuthenticationAttemptsEntity;
		activateAccountSession: ActivateAccountSessionEntity;
		forgotPasswordSession: ForgotPasswordSessionEntity;
	};
	'side-channels': {
		email: EmailSender;
		sms: SmsSender;
	};
	schedulers: {
		deleteActiveUserSession: ScheduleActiveUserSessionDeletion;
		account: {
			enable: ScheduleAccountEnabling;
			deleteUnactivated: ScheduleUnactivatedAccountDeletion;
			cancelDeleteUnactivated: CancelScheduledUnactivatedAccountDeletion;
		};
	};
	validators: {
		recaptcha: RecaptchaValidator;
		challengeResponse?: ChallengeResponseValidator;
	};
	passwordHasher: PasswordHasherInterface;
	ttl?: TTLOptions;
	thresholds?: ThresholdsOptions;
	tokensLength?: number;
	secrets: {
		totp: string;
	};
	contacts: {
		adminEmail: string;
	};
}

type InternalUsageOptions = Required<AuthEngineOptions & { ttl: Required<TTLOptions> } & { thresholds: Required<ThresholdsOptions> }>;

function fillWithDefaults(options: AuthEngineOptions): Required<InternalUsageOptions> {
	options.ttl = options.ttl || {};
	options.thresholds = options.thresholds || {};
	options.tokensLength = options.tokensLength || 20;
	return {
		entities: options.entities,
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

export { AuthenticationEngine, AuthEngineOptions, TTLOptions, ThresholdsOptions, RegistrationOptions, PasswordHasherInterface, PasswordHash };
