import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AuthenticationContext } from '../../types/requests';
import type { AccountModel } from '../../types/models';
import type { TwoFactorAuthStrategy } from '../../2fa/interface';
import type { AuthenticationSessionRepositoryHolder } from '../../sessions/authentication';

class GenerateTwoFactorAuthTokenStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>;

	public constructor(twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>) {
		this.twoFactorAuthStrategy = twoFactorAuthStrategy;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		await this.twoFactorAuthStrategy.sendToken(account, authenticationContext, authenticationSessionRepositoryHolder);
		return { done: { nextStep: AuthenticationStepName.TWO_FACTOR_AUTH_CHECK } }; // partial successful authentication
	}
}

export { GenerateTwoFactorAuthTokenStep };
