import { chrono } from '@thermopylae/lib.utils';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder.js';
import type { AuthenticationContext } from '../../types/contexts.js';
import type { OnAuthenticationFromDifferentContextHook } from '../../types/hooks.js';
import type { AccountModel } from '../../types/models.js';
import type { FailedAuthAttemptSessionRepository, SuccessfulAuthenticationsRepository } from '../../types/repositories.js';
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
		const promises: Promise<unknown>[] = [];

		if (
			authenticationContext.device &&
			!(await this.successfulAuthenticationsRepository.authBeforeFromThisDevice(account.id, authenticationContext.device))
		) {
			promises.push(this.onAuthFromDifferentContextHook(account, authenticationContext));
		}

		promises.push(
			this.failedAuthAttemptSessionRepository.delete(account.username),
			authenticationSessionRepositoryHolder.delete(),
			this.successfulAuthenticationsRepository.insert({
				id: '',
				accountId: account.id,
				ip: authenticationContext.ip,
				device: authenticationContext.device,
				location: authenticationContext.location,
				authenticatedAt: chrono.unix()
			})
		);
		await Promise.all(promises);

		return {
			done: { authenticated: account }
		};
	}
}

export { AuthenticatedStep };
