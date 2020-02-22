import { AccountModel } from '../types/models';
import { UserSessionsManager } from './user-sessions-manager';
import { getLogger } from '../logger';
import { EmailSender } from '../side-channels/email-sender';
import { AccountEntity } from '../types/entities';

class AccountStatusManager {
	private readonly adminEmail: string;
	private readonly emailSender: EmailSender;
	private readonly accountEntity: AccountEntity;
	private readonly userSessionsManager: UserSessionsManager;

	constructor(adminEmail: string, emailSender: EmailSender, accountEntity: AccountEntity, userSessionsManager: UserSessionsManager) {
		this.adminEmail = adminEmail;
		this.emailSender = emailSender;
		this.accountEntity = accountEntity;
		this.userSessionsManager = userSessionsManager;
	}

	public async disable(account: AccountModel, cause: string): Promise<void> {
		await this.accountEntity.disable(account.id!);
		this.emailSender.notifyAccountDisabled(this.adminEmail, `${cause} Account id: ${account.id}`);
		this.emailSender.notifyAccountDisabled(account.email, cause);
		await this.userSessionsManager.deleteAll(account.id!, account.role).catch(error => {
			getLogger().crit(`Failed to logout from all devices of the user with id ${account.id}. `, error);
		});
	}

	public async enable(accountId: string): Promise<void> {
		await this.accountEntity.enable(accountId);
	}
}

export { AccountStatusManager };
