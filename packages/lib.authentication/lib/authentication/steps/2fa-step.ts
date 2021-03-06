import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { EmailSender } from '../../types/side-channels';
import type { TwoFactorAuthStrategy } from '../2fa/interface';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../../types/contexts';

/**
 * @private
 */
class TwoFactorAuthStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>;

	private readonly emailSender: EmailSender<Account>;

	public constructor(twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>, emailSender: EmailSender<Account>) {
		this.emailSender = emailSender;
		this.twoFactorAuthStrategy = twoFactorAuthStrategy;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput<Account>> {
		if (await this.twoFactorAuthStrategy.isAuthenticationTokenValid(account, authenticationContext, authenticationSessionRepositoryHolder)) {
			return { nextStep: AuthenticationStepName.AUTHENTICATED };
		}

		await this.emailSender.notifyMultiFactorAuthenticationFailed(account, authenticationContext);
		return { nextStep: AuthenticationStepName.ERROR };
	}
}

export { TwoFactorAuthStep };
