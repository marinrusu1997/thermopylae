import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder.js';
import type { PasswordsManager } from '../../managers/password/index.js';
import type { AuthenticationContext } from '../../types/contexts.js';
import { AuthenticationStepName } from '../../types/enums.js';
import type { AccountModel } from '../../types/models.js';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step.js';

/** @private */
class PasswordStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly passwordsManager: PasswordsManager<Account>;

	public constructor(passwordsManager: PasswordsManager<Account>) {
		this.passwordsManager = passwordsManager;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput<Account>> {
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
