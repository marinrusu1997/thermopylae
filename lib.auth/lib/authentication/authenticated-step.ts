// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { AccessPointEntity } from '../models/entities';
import { sendNotificationAuthFromDifferentDevice, NotificationAuthFromDiffDeviceTemplate } from '../utils/email';
import { UserSessionsManager } from '../managers/user-sessions-manager';

class AuthenticatedStep implements AuthStep {
	private readonly mailer: Email;
	private readonly authFromDiffDeviceTemplate: NotificationAuthFromDiffDeviceTemplate;
	private readonly accessPointEntity: AccessPointEntity;
	private readonly userSessionsManager: UserSessionsManager;

	constructor(mailer: Email, authFromDiffDeviceTemplate: NotificationAuthFromDiffDeviceTemplate, accessPointEntity: AccessPointEntity, userSessionsManager: UserSessionsManager) {
		this.mailer = mailer;
		this.authFromDiffDeviceTemplate = authFromDiffDeviceTemplate;
		this.accessPointEntity = accessPointEntity;
		this.userSessionsManager = userSessionsManager;
	}

	async process(networkInput: AuthNetworkInput, account: Account): Promise<AuthStepOutput> {
		if (!(await this.accessPointEntity.authBeforeFromThisDevice(account.id!, networkInput.device))) {
			sendNotificationAuthFromDifferentDevice(this.authFromDiffDeviceTemplate, this.mailer, account.email, networkInput.ip, networkInput.device);
		}
		return { done: { token: await this.userSessionsManager.create(account, networkInput.ip, networkInput.device) } };
	}
}

export { AuthenticatedStep };
