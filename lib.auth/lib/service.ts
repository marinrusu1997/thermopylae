import { totp, token, chrono } from '@marin/lib.utils';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SMS } from '@marin/lib.sms';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IIssuedJWTPayload, Jwt } from '@marin/lib.jwt/lib';

import { nowInSeconds } from '@marin/lib.utils/dist/lib/chrono';
import { AuthNetworkInput, BasicRegistrationInfo } from './types';
import { AccessTokens } from './authentication/auth-step';
import {
	AccessPointEntity,
	AccountEntity,
	ActivateAccountSessionEntity,
	ActiveUserSessionEntity,
	AuthSessionEntity,
	FailedAuthAttemptsEntity,
	FailedAuthAttemptSessionEntity
} from './models/entities';
import { createException, ErrorCodes } from './error';
import { AuthOrchestrator } from './authentication/auth-orchestrator';
import { AUTH_STEP } from './enums';
import { DispatchStep } from './authentication/dispatch-step';
import { SecretStep } from './authentication/secret-step';
import { TotpStep } from './authentication/totp-step';
import { GenerateTotpStep } from './authentication/generate-totp-step';
import { RecaptchaStep } from './authentication/recaptcha-step';
import { ErrorStep } from './authentication/error-step';
import { UserSessionsManager } from './managers/user-sessions-manager';
import { AccountLocker } from './managers/account-locker';
import { AuthenticatedStep } from './authentication/authenticated-step';
import { PasswordsManager } from './managers/passwords-manager';
import { sendActivateAccountLinkToUserEmail } from './utils/email';
import { ActiveUserSession } from './models/sessions';
import { AccessPoint, FailedAuthAttempts } from './models';
import { CancelScheduledUnactivatedAccountDeletion, ScheduleActiveUserSessionDeletion, ScheduleUnactivatedAccountDeletion } from './models/schedulers';
import { getLogger } from './logger';

class AuthService {
	private readonly config: Options;
	private readonly authOrchestrator: AuthOrchestrator;
	private readonly totpManager: totp.Totp;
	private readonly userSessionsManager: UserSessionsManager;
	private readonly passwordsManager: PasswordsManager;
	private readonly accountLocker: AccountLocker;

	constructor(options: Partial<Options>) {
		this.config = fillWithDefaults(options);
		this.totpManager = new totp.Totp({ ttl: this.config.ttl.totp, secret: this.config.secrets.totp });
		this.userSessionsManager = new UserSessionsManager(
			this.config.schedulers.deleteActiveUserSession,
			this.config.jwt.instance,
			this.config.jwt.rolesTtl,
			this.config.entities.activeUserSession,
			this.config.entities.accessPoint
		);
		this.passwordsManager = new PasswordsManager(this.config.thresholds.passwordBreach);
		this.accountLocker = new AccountLocker(this.userSessionsManager, this.config['side-channels'].email, this.config.templates.accountLocked);

		this.authOrchestrator = new AuthOrchestrator();
		this.authOrchestrator.register(AUTH_STEP.DISPATCH, new DispatchStep());
		this.authOrchestrator.register(AUTH_STEP.SECRET, new SecretStep(this.config.secrets.pepper));
		this.authOrchestrator.register(AUTH_STEP.GENERATE_TOTP, new GenerateTotpStep(this.totpManager, this.config['side-channels'].sms, this.config.templates.totpTokenSms));
		this.authOrchestrator.register(AUTH_STEP.TOTP, new TotpStep(this.totpManager, this.config['side-channels'].email, this.config.templates.multiFactorAuthFailed));
		this.authOrchestrator.register(AUTH_STEP.RECAPTCHA, new RecaptchaStep(this.config.secrets.recaptcha));
		this.authOrchestrator.register(
			AUTH_STEP.ERROR,
			new ErrorStep(
				this.config.contacts.adminEmail,
				this.config.thresholds.maxFailedAuthAttempts,
				this.config.thresholds.recaptcha,
				this.config.ttl.failedAuthAttemptsSession,
				this.config.entities.account,
				this.config.entities.failedAuthAttemptsSession,
				this.config.entities.failedAuthAttempts,
				this.accountLocker
			)
		);
		this.authOrchestrator.register(
			AUTH_STEP.AUTHENTICATED,
			new AuthenticatedStep(this.config['side-channels'].email, this.config.templates.authFromDiffDevice, this.config.entities.accessPoint, this.userSessionsManager)
		);
	}

	/**
	 * @access public
	 */
	public async authenticate(data: AuthNetworkInput): Promise<string | AccessTokens> {
		const account = await this.config.entities.account.read(data.username);

		if (!account) {
			throw createException(ErrorCodes.NOT_FOUND, `Account ${data.username} not found.`, data);
		}

		if (account.locked) {
			throw createException(ErrorCodes.CHECKING_FAILED, `Account ${account.username} is locked`);
		}
		if (!account.activated) {
			throw createException(ErrorCodes.CHECKING_FAILED, `Account ${account.username} is not activated`);
		}

		let authSession = await this.config.entities.authSession.read(data.username, data.device);
		if (!authSession) {
			authSession = await this.config.entities.authSession.create(data.username, data.device, this.config.ttl.authSession);
		}

		const result = await this.authOrchestrator.authenticate(data, account, authSession);

		if (typeof result === 'string') {
			await this.config.entities.authSession.update(data.username, data.device, authSession);
		} else {
			await this.config.entities.authSession.delete(data.username, data.device);
		}

		return result;
	}

	/**
	 * @access public
	 */
	public async register(registrationInfo: BasicRegistrationInfo, options?: Partial<RegistrationOptions>): Promise<void> {
		options = options || {};
		options.useMultiFactorAuth = (options && options.useMultiFactorAuth) || false;
		options.isActivated = (options && options.isActivated) || false;

		const account = await this.config.entities.account.read(registrationInfo.username);
		if (account) {
			throw createException(ErrorCodes.ALREADY_REGISTERED, `Account ${registrationInfo.username} is registered already.`);
		}

		await this.passwordsManager.validateStrengthness(registrationInfo.password);
		const salt = await token.generateToken(this.config.sizes.salt);
		const passwordHash = await PasswordsManager.hash(registrationInfo.password, salt.plain, this.config.secrets.pepper);
		const registeredAccount = await this.config.entities.account.create({
			username: registrationInfo.username,
			password: passwordHash,
			salt: salt.plain,
			telephone: registrationInfo.telephone,
			email: registrationInfo.email,
			role: registrationInfo.role,
			locked: false,
			activated: options.isActivated,
			mfa: options.useMultiFactorAuth
		});

		if (!options.isActivated) {
			let activateToken: any;
			let deleteAccountTaskId;
			let activateAccountSessionWasCreated = false;
			try {
				activateToken = await token.generateToken(this.config.sizes.token);
				deleteAccountTaskId = await this.config.schedulers.account.deleteUnactivated(
					registeredAccount.id!,
					chrono.dateFromSeconds(nowInSeconds() + chrono.minutesToSeconds(this.config.ttl.activateAccountSession))
				);
				await this.config.entities.activateAccountSession.create(
					activateToken.plain,
					{ accountId: registeredAccount.id!, taskId: deleteAccountTaskId },
					this.config.ttl.activateAccountSession
				);
				activateAccountSessionWasCreated = true;
				await sendActivateAccountLinkToUserEmail(this.config.templates.activateAccount, this.config['side-channels'].email, registeredAccount.email, activateToken.plain);
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
				.catch(err => getLogger().error(`Failed to delete activate account session with id ${activateAccountToken} for account with id ${session.accountId}`, err))
		]);
	}

	/**
	 * @access private
	 */
	public requireMultiFactorAuth(accountId: string, required: boolean): Promise<void> {
		return this.config.entities.account.requireMfa(accountId, required);
	}

	/**
	 * @access private
	 */
	public logout(payload: IIssuedJWTPayload): Promise<void> {
		return this.userSessionsManager.delete(payload);
	}

	/**
	 * @access private
	 */
	public logoutFromAllDevices(accountId: string): Promise<number> {
		return this.config.entities.account.readById(accountId).then(account => {
			if (!account) {
				throw createException(ErrorCodes.NOT_FOUND, `Account with id ${accountId} was not found.`);
			}
			return this.userSessionsManager.deleteAll(account);
		});
	}

	/**
	 * @access private
	 */
	public getActiveSessions(accountId: string): Promise<Array<ActiveUserSession & AccessPoint>> {
		return this.config.entities.activeUserSession.readAll(accountId);
	}

	/**
	 * @access private
	 */
	public getFailedAuthAttempts(accountId: string, startingFrom?: number, endingTo?: number): Promise<Array<FailedAuthAttempts>> {
		return this.config.entities.failedAuthAttempts.readRange(accountId, startingFrom, endingTo);
	}
}

interface Options {
	jwt: {
		instance: Jwt;
		rolesTtl: Map<string, number>; // role -> seconds
	};
	entities: {
		account: AccountEntity;
		activeUserSession: ActiveUserSessionEntity;
		authSession: AuthSessionEntity;
		accessPoint: AccessPointEntity;
		failedAuthAttemptsSession: FailedAuthAttemptSessionEntity;
		failedAuthAttempts: FailedAuthAttemptsEntity;
		activateAccountSession: ActivateAccountSessionEntity;
	};
	'side-channels': {
		email: Email;
		sms: SMS;
	};
	templates: {
		totpTokenSms: (totp: string) => string;
		multiFactorAuthFailed: (data: { ip: string; device: string }) => string;
		accountLocked: (data: { cause: string }) => string;
		authFromDiffDevice: (data: { ip: string; device: string }) => string;
		activateAccount: (data: { token: string }) => string;
	};
	schedulers: {
		deleteActiveUserSession: ScheduleActiveUserSessionDeletion;
		account: {
			deleteUnactivated: ScheduleUnactivatedAccountDeletion;
			cancelDelete: CancelScheduledUnactivatedAccountDeletion;
		};
	};
	ttl: {
		authSession: number; // minutes
		failedAuthAttemptsSession: number; // minutes
		activateAccountSession: number; // minutes
		totp: number; // seconds
	};
	thresholds: {
		maxFailedAuthAttempts: number;
		recaptcha: number;
		passwordBreach: number;
	};
	sizes: {
		salt: number;
		token: number;
	};
	secrets: {
		pepper: string;
		totp: string;
		recaptcha: string;
	};
	contacts: {
		adminEmail: string;
	};
}

interface RegistrationOptions {
	useMultiFactorAuth: boolean;
	isActivated: boolean; // based on user role, account can be activated or not at the registration time
}

function fillWithDefaults(options: Partial<Options>): Options {
	// @ts-ignore
	options.ttl = options.ttl || {};
	// @ts-ignore
	options.thresholds = options.thresholds || {};
	// @ts-ignore
	options.sizes = options.sizes || {};
	return {
		jwt: options.jwt!,
		entities: options.entities!,
		ttl: {
			authSession: options.ttl!.authSession || 5, // minutes
			failedAuthAttemptsSession: options.ttl!.failedAuthAttemptsSession || 5, // minutes,
			activateAccountSession: options.ttl!.activateAccountSession || 60, // minutes
			totp: options.ttl!.totp || 30 // seconds
		},
		thresholds: {
			maxFailedAuthAttempts: options.thresholds!.maxFailedAuthAttempts || 15,
			recaptcha: options.thresholds!.recaptcha || 10,
			passwordBreach: options.thresholds!.passwordBreach || 5
		},
		sizes: {
			salt: options.sizes!.salt || 10,
			token: options.sizes!.token || 20
		},
		secrets: options.secrets!,
		templates: options.templates!,
		contacts: options.contacts!,
		'side-channels': options['side-channels']!,
		schedulers: options.schedulers!
	};
}

export { AuthService };
