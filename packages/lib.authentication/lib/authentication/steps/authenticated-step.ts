import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthenticationContext } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { SuccessfulAuthenticationsRepository, FailedAuthAttemptSessionRepository } from '../../types/repositories';
import { EmailSender } from '../../side-channels';
import { logger } from '../../logger';

class AuthenticatedStep implements AuthStep {
	private readonly emailSender: EmailSender;

	private readonly accessPointEntity: SuccessfulAuthenticationsRepository;

	private readonly failedAuthAttemptSessionEntity: FailedAuthAttemptSessionRepository;

	public constructor(
		emailSender: EmailSender,
		accessPointEntity: SuccessfulAuthenticationsRepository,
		failedAuthAttemptSessionEntity: FailedAuthAttemptSessionRepository
	) {
		this.emailSender = emailSender;
		this.accessPointEntity = accessPointEntity;
		this.failedAuthAttemptSessionEntity = failedAuthAttemptSessionEntity;
	}

	async process(authRequest: AuthenticationContext, account: AccountModel): Promise<AuthStepOutput> {
		if (!(await this.accessPointEntity.authBeforeFromThisDevice(account.id!, authRequest.device))) {
			this.emailSender.notifyAuthenticationFromDifferentDevice(account.email, authRequest.ip, authRequest.device);
		}

		// FIXME this call violates encapsulation of the error step, this might be moved to engine and called based on a flag from session
		// reset failed auth attempts on successful authentication (in detached mode)
		this.failedAuthAttemptSessionEntity
			.delete(account.username)
			.catch((e) => logger.error(`Failed to delete failed auth attempts session for account id ${account.id!}. `, e));

		const sessionToken = await this.userSessionsManager.create(authRequest.ip, authRequest.device, authRequest.location, account.id!, account.role);

		return {
			done: { token: sessionToken }
		};
	}
}

export { AuthenticatedStep };
