import { chrono } from '@marin/lib.utils';
import { AccountModel } from '../types/models';
import { UserSessionsManager } from './user-sessions-manager';
import { getLogger } from '../logger';
import { EmailSender } from '../side-channels/email-sender';
import { AccountEntity } from '../types/entities';
import { ScheduleAccountEnabling } from '../types/schedulers';
import { createException, ErrorCodes } from '../error';

const enum EnableAfterCause {
	FAILED_AUTH_ATTEMPT = 'FAILED_AUTH_ATTEMPT'
}

class AccountStatusManager {
	private readonly adminEmail: string;

	private readonly emailSender: EmailSender;

	private readonly accountEntity: AccountEntity;

	private readonly userSessionsManager: UserSessionsManager;

	private readonly enableAccountScheduler: ScheduleAccountEnabling;

	private readonly enableAccountAfterFailedAuthAttemptDelay: number;

	constructor(
		adminEmail: string,
		enableAccountAfterFailedAuthAttemptDelayMinutes: number,
		emailSender: EmailSender,
		accountEntity: AccountEntity,
		userSessionsManager: UserSessionsManager,
		enableAccountScheduler: ScheduleAccountEnabling
	) {
		this.adminEmail = adminEmail;
		this.emailSender = emailSender;
		this.accountEntity = accountEntity;
		this.userSessionsManager = userSessionsManager;
		this.enableAccountScheduler = enableAccountScheduler;
		this.enableAccountAfterFailedAuthAttemptDelay = enableAccountAfterFailedAuthAttemptDelayMinutes;
	}

	public async enable(accountId: string): Promise<void> {
		await this.accountEntity.enable(accountId);
	}

	public async disable(account: AccountModel, cause: string): Promise<void> {
		await this.accountEntity.disable(account.id!);
		this.emailSender.notifyAccountDisabled(this.adminEmail, `${cause} Account id: ${account.id}`);
		this.emailSender.notifyAccountDisabled(account.email, cause);
		await this.userSessionsManager.deleteAll(account.id!, account.role).catch(error => {
			getLogger().crit(`Failed to logout from all devices of the user with id ${account.id}. `, error);
		});
	}

	public async enableAfter(accountId: string, cause: EnableAfterCause): Promise<void> {
		if (cause === EnableAfterCause.FAILED_AUTH_ATTEMPT) {
			await this.enableAccountScheduler(
				accountId,
				chrono.dateFromUNIX(chrono.dateToUNIX() + chrono.minutesToSeconds(this.enableAccountAfterFailedAuthAttemptDelay))
			);
		} else {
			throw createException(ErrorCodes.MISCONFIGURATION, `Scheduling account enabling failed. Provided cause parameter is unknown: ${cause}`);
		}
	}
}

export { AccountStatusManager, EnableAfterCause };