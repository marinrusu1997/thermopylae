import { totp } from '@marin/lib.utils';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SMS } from '@marin/lib.sms';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Jwt } from '@marin/lib.jwt';
import { AuthNetworkInput, ScheduleDeletionUserSession } from './types';
import { AccessTokens } from './authentication/auth-step';
import {
	AccessPointEntity,
	AccountEntity,
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

class AuthService {
	private readonly config: Options;
	private readonly authOrchestrator: AuthOrchestrator;
	private readonly totpManager: totp.Totp;
	private readonly userSessionsManager: UserSessionsManager;
	private readonly accountLocker: AccountLocker;

	constructor(options: Partial<Options>) {
		this.config = fillWithDefaults(options);
		this.totpManager = new totp.Totp({ ttl: this.config.ttl.totp, secret: this.config.secrets.totp });
		this.userSessionsManager = new UserSessionsManager(
			this.config.schedulers.deleteActiveUserSession,
			this.config.jwt.issuer,
			this.config.jwt.instance,
			this.config.jwt.rolesTtl,
			this.config.entities.activeUserSession,
			this.config.entities.accessPoint
		);
		this.accountLocker = new AccountLocker(this.userSessionsManager, this.config['side-channels'].email, this.config.templates.accountLocked);

		this.authOrchestrator = new AuthOrchestrator();
		this.authOrchestrator.register(AUTH_STEP.DISPATCH, new DispatchStep());
		this.authOrchestrator.register(AUTH_STEP.SECRET, new SecretStep(this.config.secrets.pepper));
		this.authOrchestrator.register(AUTH_STEP.GENERATE_TOTP, new GenerateTotpStep(this.totpManager, this.config['side-channels'].sms));
		this.authOrchestrator.register(
			AUTH_STEP.TOTP,
			new TotpStep(this.totpManager, this.config['side-channels'].email, this.config.templates.multiFactorAuthFailed)
		);
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
			new AuthenticatedStep(
				this.config['side-channels'].email,
				this.config.templates.authFromDiffDevice,
				this.config.entities.accessPoint,
				this.userSessionsManager
			)
		);
	}

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
}

interface Options {
	jwt: {
		instance: Jwt;
		issuer: string;
		rolesTtl: Map<string, number>;
	};
	entities: {
		account: AccountEntity;
		activeUserSession: ActiveUserSessionEntity;
		authSession: AuthSessionEntity;
		accessPoint: AccessPointEntity;
		failedAuthAttemptsSession: FailedAuthAttemptSessionEntity;
		failedAuthAttempts: FailedAuthAttemptsEntity;
	};
	ttl: {
		authSession: number;
		failedAuthAttemptsSession: number;
		totp: number;
	};
	thresholds: {
		maxFailedAuthAttempts: number;
		recaptcha: number;
	};
	secrets: {
		pepper: string;
		totp: string;
		recaptcha: string;
	};
	templates: {
		multiFactorAuthFailed: Function;
		accountLocked: Function;
		authFromDiffDevice: Function;
	};
	contacts: {
		adminEmail: string;
	};
	'side-channels': {
		email: Email;
		sms: SMS;
	};
	schedulers: {
		deleteActiveUserSession: ScheduleDeletionUserSession;
	};
}

function fillWithDefaults(options: Partial<Options>): Options {
	// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
	// @ts-ignore
	options.ttl = options.ttl || {};
	// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
	// @ts-ignore
	options.thresholds = options.thresholds || {};
	return {
		jwt: options.jwt!,
		entities: options.entities!,
		ttl: {
			authSession: options.ttl!.authSession || 5, // minutes
			failedAuthAttemptsSession: options.ttl!.failedAuthAttemptsSession || 5, // minutes
			totp: options.ttl!.totp || 30 // seconds
		},
		thresholds: {
			maxFailedAuthAttempts: options.thresholds!.maxFailedAuthAttempts || 15,
			recaptcha: options.thresholds!.recaptcha || 10
		},
		secrets: options.secrets!,
		templates: options.templates!,
		contacts: options.contacts!,
		'side-channels': options['side-channels']!,
		schedulers: options.schedulers!
	};
}

export { AuthService };
