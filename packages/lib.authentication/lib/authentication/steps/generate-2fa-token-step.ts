import type { TwoFactorAuthStrategy } from '../2fa/interface.js';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder.js';
import type { AuthenticationContext } from '../../types/contexts.js';
import { AuthenticationStepName } from '../../types/enums.js';
import type { AccountModel } from '../../types/models.js';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step.js';

/** @private */
class GenerateTwoFactorAuthTokenStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>;

	public constructor(twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>) {
		this.twoFactorAuthStrategy = twoFactorAuthStrategy;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput<Account>> {
		await this.twoFactorAuthStrategy.sendAuthenticationToken(account, authenticationContext, authenticationSessionRepositoryHolder);
		return { done: { nextStep: AuthenticationStepName.TWO_FACTOR_AUTH_CHECK } }; // partial successful authentication
	}
}

export { GenerateTwoFactorAuthTokenStep };
