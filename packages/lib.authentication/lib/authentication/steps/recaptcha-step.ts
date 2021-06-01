import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AuthenticationContext } from '../../types/requests';
import type { AccountModel } from '../../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../../sessions/authentication';

type RecaptchaValidator = (authenticationContext: AuthenticationContext) => Promise<boolean>;

class RecaptchaStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly recaptchaValidator: RecaptchaValidator;

	public constructor(recaptchaValidator: RecaptchaValidator) {
		this.recaptchaValidator = recaptchaValidator;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput> {
		if (authenticationContext.recaptcha == null) {
			return { nextStep: AuthenticationStepName.ERROR };
		}

		if (!(await this.recaptchaValidator(authenticationContext))) {
			return { nextStep: AuthenticationStepName.ERROR };
		}

		const authenticationSession = await authenticationSessionRepositoryHolder.get();
		authenticationSession.recaptchaRequired = false;
		if (account.mfa) {
			return { nextStep: AuthenticationStepName.GENERATE_2FA_TOKEN };
		}

		return { nextStep: AuthenticationStepName.AUTHENTICATED };
	}
}

export { RecaptchaStep, RecaptchaValidator };
