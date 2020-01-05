// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
import { Account } from '../models';
import { UserSessionsManager } from './user-sessions-manager';
import { getLogger } from '../logger';
import { sendNotificationAccountLockedToAdminEmail, sendNotificationAccountLockedToUserEmail, NotificationAccountLockedTemplate } from '../utils/email';
import { AccountEntity } from '../models/entities';

class AccountLocker {
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

	public lock(account: Account, adminEmail: string, cause: string): Promise<void> {
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
}

export { AccountLocker };
