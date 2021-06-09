import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { SuccessfulAuthenticationsRepository, FailedAuthAttemptSessionRepository } from '../../types/repositories';
import type { EmailSender } from '../../types/side-channels';
import type { AuthenticationContext } from '../../types/contexts';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import { getCurrentTimestamp } from '../../utils';

class AuthenticatedStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly emailSender: EmailSender<Account>;

	private readonly successfulAuthenticationsRepository: SuccessfulAuthenticationsRepository;

	private readonly failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository;

	public constructor(
		emailSender: EmailSender<Account>,
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
		let index = 0;
		let promises: Array<Promise<unknown>>;

		if (
			authenticationContext.device &&
			!(await this.successfulAuthenticationsRepository.authBeforeFromThisDevice(account.id, authenticationContext.device))
		) {
			promises = new Array<Promise<unknown>>(4);
			promises[index++] = this.emailSender.notifyAuthenticationFromDifferentDevice(account, authenticationContext);
		} else {
			promises = new Array<Promise<unknown>>(3);
		}

		promises[index++] = this.failedAuthAttemptSessionRepository.delete(account.username);
		promises[index++] = authenticationSessionRepositoryHolder.delete();
		promises[index++] = this.successfulAuthenticationsRepository.insert({
			id: undefined!,
			accountId: account.id,
			ip: authenticationContext.ip,
			device: authenticationContext.device,
			location: authenticationContext.location,
			authenticatedAt: getCurrentTimestamp()
		});

		await Promise.all(promises);

		return {
			done: { authenticated: true }
		};
	}
}

export { AuthenticatedStep };
