import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AuthenticationContext } from '../../types/requests';
import type { AccountModel } from '../../types/models';
import type { EmailSender } from '../../side-channels';
import type { TwoFactorAuthStrategy } from '../../2fa/interface';
import type { AuthenticationSessionRepositoryHolder } from '../../sessions/authentication';

class TwoFactorAuthStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>;

	private readonly emailSender: EmailSender;

	public constructor(twoFactorAuthStrategy: TwoFactorAuthStrategy<Account>, emailSender: EmailSender) {
		this.emailSender = emailSender;
		this.twoFactorAuthStrategy = twoFactorAuthStrategy;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		if (authenticationContext['2fa-token'] == null) {
			// received invalid token or someone is trying to use same token twice -> treat as error
			return { nextStep: AuthenticationStepName.ERROR };
		}

		if (await this.twoFactorAuthStrategy.isTokenValid(account, authenticationContext, authenticationSessionRepositoryHolder)) {
			return { nextStep: AuthenticationStepName.AUTHENTICATED };
		}

		await this.emailSender.notifyMultiFactorAuthenticationFailed(account.email, authenticationContext);
		return { nextStep: AuthenticationStepName.ERROR };
	}
}

export { TwoFactorAuthStep };
