// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
import { AccountModel } from '../types/models';
import { UserSessionsManager } from './user-sessions-manager';
import { getLogger } from '../logger';
import { sendNotificationAccountLockedToAdminEmail, sendNotificationAccountLockedToUserEmail, NotificationAccountLockedTemplate } from '../email';
import { AccountEntity } from '../types/entities';

class AccountLockingManager {
	private readonly accountEntity: AccountEntity;
	private readonly userSessionsManager: UserSessionsManager;
	private readonly mailer: Email;
	private readonly template: NotificationAccountLockedTemplate;

	constructor(accountEntity: AccountEntity, userSessionsManager: UserSessionsManager, mailer: Email, template: NotificationAccountLockedTemplate) {
		this.accountEntity = accountEntity;
		this.userSessionsManager = userSessionsManager;
		this.mailer = mailer;
		this.template = template;
	}

	public lock(account: AccountModel, adminEmail: string, cause: string): Promise<void> {
		return this.accountEntity
			.lock(account.id!)
			.then(() => {
				return sendNotificationAccountLockedToAdminEmail(this.mailer, adminEmail, account.id!, cause).catch((error: Error) => {
					getLogger().error(`Failed to deliver account locked email to admin ${adminEmail}`, error);
				});
			})
			.then(() => {
				return sendNotificationAccountLockedToUserEmail(this.template, this.mailer, account.email, cause);
			})
			.then(() => {
				return this.userSessionsManager.deleteAll(account.id!, account.role).catch((error: Error) => {
					getLogger().error(`Failed to logout from all devices of the user ${account.username}`, error);
				}) as Promise<void>;
			});
	}

	public unlock(accountId: string): Promise<void> {
		return this.accountEntity.unlock(accountId);
	}
}

export { AccountLockingManager };
