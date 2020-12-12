import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AuthenticationEntryPointEntity, FailedAuthAttemptSessionEntity } from '../../types/entities';
import { EmailSender } from '../../side-channels/email-sender';
import { UserSessionsManager } from '../../managers/user-sessions-manager';
import { getLogger } from '../../logger';

class AuthenticatedStep implements AuthStep {
	private readonly emailSender: EmailSender;

	private readonly userSessionsManager: UserSessionsManager;

	private readonly accessPointEntity: AuthenticationEntryPointEntity;

	private readonly failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity;

	constructor(
		emailSender: EmailSender,
		userSessionsManager: UserSessionsManager,
		accessPointEntity: AuthenticationEntryPointEntity,
		failedAuthAttemptSessionEntity: FailedAuthAttemptSessionEntity
	) {
		this.emailSender = emailSender;
		this.userSessionsManager = userSessionsManager;
		this.accessPointEntity = accessPointEntity;
		this.failedAuthAttemptSessionEntity = failedAuthAttemptSessionEntity;
	}

	async process(authRequest: AuthRequest, account: AccountModel): Promise<AuthStepOutput> {
		if (!(await this.accessPointEntity.authBeforeFromThisDevice(account.id!, authRequest.device))) {
			this.emailSender.notifyAuthenticationFromDifferentDevice(account.email, authRequest.ip, authRequest.device);
		}

		// FIXME this call violates encapsulation of the error step, this might be moved to engine and called based on a flag from session
		// reset failed auth attempts on successful authentication (in detached mode)
		this.failedAuthAttemptSessionEntity
			.delete(account.username)
			.catch(e => getLogger().error(`Failed to delete failed auth attempts session for account id ${account.id!}. `, e));

		const sessionToken = await this.userSessionsManager.create(authRequest.ip, authRequest.device, authRequest.location, account.id!, account.role);

		return {
			done: { token: sessionToken }
		};
	}
}

export { AuthenticatedStep };
