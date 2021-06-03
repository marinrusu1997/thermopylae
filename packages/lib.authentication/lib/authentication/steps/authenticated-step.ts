import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { SuccessfulAuthenticationsRepository, FailedAuthAttemptSessionRepository } from '../../types/repositories';
import type { EmailSender } from '../../types/side-channels';
import type { AuthenticationContext } from '../../types/contexts';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';

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

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		if (
			authenticationContext.device &&
			!(await this.successfulAuthenticationsRepository.authBeforeFromThisDevice(account.id, authenticationContext.device))
		) {
			await this.emailSender.notifyAuthenticationFromDifferentDevice(account.email, authenticationContext);
		}

		await Promise.all([this.failedAuthAttemptSessionRepository.delete(account.username), authenticationSessionRepositoryHolder.delete()]);

		return {
			done: { authenticated: true }
		};
	}
}

export { AuthenticatedStep };
