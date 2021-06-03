import { AuthenticationStepName } from '../../types/enums';
import type { PasswordsManager } from '../../managers/password';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../../types/contexts';

class PasswordStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly passwordsManager: PasswordsManager<Account>;

	public constructor(passwordsManager: PasswordsManager<Account>) {
		this.passwordsManager = passwordsManager;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		if (!(await this.passwordsManager.isSame(authenticationContext.password!, account.passwordHash, account.passwordSalt, account.passwordAlg))) {
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
