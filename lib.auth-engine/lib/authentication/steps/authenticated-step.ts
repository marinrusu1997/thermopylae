import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AccessPointEntity, FailedAuthAttemptSessionEntity } from '../../types/entities';
import { EmailSender } from '../../side-channels/email-sender';
import { UserSessionsManager } from '../../managers/user-sessions-manager';
import { getLogger } from '../../logger';

class AuthenticatedStep implements AuthStep {
	private readonly emailSender: EmailSender;
	private readonly userSessionsManager: UserSessionsManager;
	private readonly accessPointEntity: AccessPointEntity;
	private readonly failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity;

	constructor(
		emailSender: EmailSender,
		userSessionsManager: UserSessionsManager,
		accessPointEntity: AccessPointEntity,
		failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity
	) {
		this.emailSender = emailSender;
		this.userSessionsManager = userSessionsManager;
		this.accessPointEntity = accessPointEntity;
		this.failedAuthAttemptSessionEntity = failedAuthAttemptSessionEntity;
	}

	async process(networkInput: AuthRequest, account: AccountModel): Promise<AuthStepOutput> {
		if (!(await this.accessPointEntity.authBeforeFromThisDevice(account.id!, networkInput.device))) {
			this.emailSender.notifyAuthenticationFromDifferentDevice(account.email, networkInput.ip, networkInput.device);
		}
		// reset failed auth attempts on successful authentication (in detached mode)
		this.failedAuthAttemptSessionEntity
			.delete(account.username)
			.catch(e => getLogger().error(`Failed to delete failed auth attempts session for account id ${account.id!}. `, e));

		const sessionToken = await this.userSessionsManager.create(networkInput.ip, networkInput.device, networkInput.location, account.id!, account.role);

		return {
			done: { token: sessionToken }
		};
	}
}

export { AuthenticatedStep };
