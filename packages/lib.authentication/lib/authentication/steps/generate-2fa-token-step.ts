import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { TwoFactorAuthStrategy } from '../2fa/interface';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../../types/contexts';

/**
 * @private
 */
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
