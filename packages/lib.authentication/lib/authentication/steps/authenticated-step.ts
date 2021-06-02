import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { SuccessfulAuthenticationsRepository, FailedAuthAttemptSessionRepository } from '../../types/repositories';
import type { EmailSender } from '../../side-channels';
import type { AuthenticationContext } from '../../types/contexts';

class AuthenticatedStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly emailSender: EmailSender;

	private readonly successfulAuthenticationsRepository: SuccessfulAuthenticationsRepository;

	private readonly failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository;

	public constructor(
		emailSender: EmailSender,
		successfulAuthenticationsRepository: SuccessfulAuthenticationsRepository,
		failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository
	) {
		this.emailSender = emailSender;
		this.successfulAuthenticationsRepository = successfulAuthenticationsRepository;
		this.failedAuthAttemptSessionRepository = failedAuthAttemptSessionRepository;
	}

	public async process(account: Account, authenticationContext: AuthenticationContext): Promise<AuthenticationStepOutput> {
		if (
			authenticationContext.device &&
			!(await this.successfulAuthenticationsRepository.authBeforeFromThisDevice(account.id, authenticationContext.device))
		) {
			await this.emailSender.notifyAuthenticationFromDifferentDevice(account.email, authenticationContext);
		}

		// reset failed auth attempts on successful authentication (in detached mode)
		await this.failedAuthAttemptSessionRepository.delete(account.username);

		return {
			done: { authenticated: true }
		};
	}
}

export { AuthenticatedStep };
