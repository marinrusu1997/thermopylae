import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder.js';
import type { AuthenticationContext } from '../../types/contexts.js';
import type { OnAuthenticationFromDifferentContextHook } from '../../types/hooks.js';
import type { AccountModel } from '../../types/models.js';
import type { FailedAuthAttemptSessionRepository, SuccessfulAuthenticationsRepository } from '../../types/repositories.js';
import { getCurrentTimestamp } from '../../utils.js';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step.js';

/** @private */
class AuthenticatedStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly onAuthFromDifferentContextHook: OnAuthenticationFromDifferentContextHook<Account>;

	private readonly successfulAuthenticationsRepository: SuccessfulAuthenticationsRepository;

	private readonly failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository;

	public constructor(
		onAuthFromDifferentContextHook: OnAuthenticationFromDifferentContextHook<Account>,
		successfulAuthenticationsRepository: SuccessfulAuthenticationsRepository,
		failedAuthAttemptSessionRepository: FailedAuthAttemptSessionRepository
	) {
		this.successfulAuthenticationsRepository = successfulAuthenticationsRepository;
		this.failedAuthAttemptSessionRepository = failedAuthAttemptSessionRepository;
		this.onAuthFromDifferentContextHook = onAuthFromDifferentContextHook;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput<Account>> {
		let index = 0;
		let promises: Array<Promise<unknown>>;

		if (
			authenticationContext.device &&
			!(await this.successfulAuthenticationsRepository.authBeforeFromThisDevice(account.id, authenticationContext.device))
		) {
			promises = new Array<Promise<unknown>>(4);
			promises[index++] = this.onAuthFromDifferentContextHook(account, authenticationContext);
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
			done: { authenticated: account }
		};
	}
}

export { AuthenticatedStep };
