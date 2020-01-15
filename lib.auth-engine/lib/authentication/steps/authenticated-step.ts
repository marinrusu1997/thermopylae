// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AccessPointEntity, FailedAuthAttemptSessionEntity } from '../../types/entities';
import { sendNotificationAuthFromDifferentDevice, NotificationAuthFromDiffDeviceTemplate } from '../../email';
import { UserSessionsManager } from '../../managers/user-sessions-manager';
import { getLogger } from '../../logger';

class AuthenticatedStep implements AuthStep {
	private readonly mailer: Email;
	private readonly authFromDiffDeviceTemplate: NotificationAuthFromDiffDeviceTemplate;
	private readonly userSessionsManager: UserSessionsManager;
	private readonly accessPointEntity: AccessPointEntity;
	private readonly failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity;

	constructor(
		mailer: Email,
		authFromDiffDeviceTemplate: NotificationAuthFromDiffDeviceTemplate,
		userSessionsManager: UserSessionsManager,
		accessPointEntity: AccessPointEntity,
		failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity
	) {
		this.mailer = mailer;
		this.authFromDiffDeviceTemplate = authFromDiffDeviceTemplate;
		this.userSessionsManager = userSessionsManager;
		this.accessPointEntity = accessPointEntity;
		this.failedAuthAttemptSessionEntity = failedAuthAttemptSessionEntity;
	}

	async process(networkInput: AuthRequest, account: AccountModel): Promise<AuthStepOutput> {
		if (!(await this.accessPointEntity.authBeforeFromThisDevice(account.id!, networkInput.device))) {
			sendNotificationAuthFromDifferentDevice(this.authFromDiffDeviceTemplate, this.mailer, account.email, networkInput.ip, networkInput.device);
		}
		// reset failed auth attempts on successful authentication (in detached mode)
		this.failedAuthAttemptSessionEntity
			.delete(account.username)
			.catch(e => getLogger().error(`Failed to delete failed auth attempts session for account id ${account.id!}. `, e));

		return {
			done: { token: await this.userSessionsManager.create(networkInput.ip, networkInput.device, networkInput.location, account.id!, account.role) }
		};
	}
}

export { AuthenticatedStep };
