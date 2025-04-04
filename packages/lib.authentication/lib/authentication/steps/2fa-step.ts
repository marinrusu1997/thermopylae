import type { TwoFactorAuthStrategy } from '../2fa/interface.js';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder.js';
import type { AuthenticationContext } from '../../types/contexts.js';
import { AuthenticationStepName } from '../../types/enums.js';
import type { AccountModel } from '../../types/models.js';
import type { EmailSender } from '../../types/side-channels.js';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step.js';

/** @private */
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
