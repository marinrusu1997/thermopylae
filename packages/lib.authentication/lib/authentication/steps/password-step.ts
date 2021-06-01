import { AuthenticationStepName } from '../../types/enums';
import type { PasswordsManager } from '../../managers/passwords-manager';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { AuthenticationContext } from '../../types/requests';
import type { AuthenticationSessionRepositoryHolder } from '../../sessions/authentication';

class PasswordStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly passwordsManager: PasswordsManager;

	public constructor(passwordsManager: PasswordsManager) {
		this.passwordsManager = passwordsManager;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		if (!(await this.passwordsManager.isSame(authenticationContext.password!, account))) {
			return { nextStep: AuthenticationStepName.ERROR };
		}

		const authenticationSession = await authenticationSessionRepositoryHolder.get();
		if (authenticationSession.recaptchaRequired) {
			return { nextStep: AuthenticationStepName.RECAPTCHA };
		}

		if (account.mfa) {
			return { nextStep: AuthenticationStepName.GENERATE_2FA_TOKEN };
		}

		return { nextStep: AuthenticationStepName.AUTHENTICATED };
	}
}

export { PasswordStep };
