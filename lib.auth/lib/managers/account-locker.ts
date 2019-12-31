// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
import { Account } from '../models';
import { UserSessionsManager } from './user-sessions-manager';
import { logger } from '../logger';
import { sendNotificationAccountLockedToAdminEmail, sendNotificationAccountLockedToUserEmail, NotificationAccountLockedTemplate } from '../utils/email';

class AccountLocker {
	private readonly userSessionsManager: UserSessionsManager;
	private readonly mailer: Email;
	private readonly template: NotificationAccountLockedTemplate;

	constructor(userSessionsManager: UserSessionsManager, mailer: Email, template: NotificationAccountLockedTemplate) {
		this.userSessionsManager = userSessionsManager;
		this.mailer = mailer;
		this.template = template;
	}

	public prepareLocking(account: Account, adminEmail: string, cause: string): Promise<void> {
		return sendNotificationAccountLockedToAdminEmail(this.mailer, adminEmail, account.id!, cause)
			.then(() => {
				sendNotificationAccountLockedToUserEmail(this.template, this.mailer, account.email, cause);
			})
			.then(() => {
				this.userSessionsManager.deleteAll(account).catch((error: Error) => {
					logger.warn(`Failed to logout from all devices of the user ${account.username}`, error);
				});
			})
			.catch((error: Error) => {
				logger.error(`Failed to deliver account locked email to admin ${adminEmail}`, error);
			});
	}
}

export { AccountLocker };
