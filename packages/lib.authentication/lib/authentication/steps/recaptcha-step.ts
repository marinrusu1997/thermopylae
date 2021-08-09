import { AuthenticationStepName } from '../../types/enums';
import type { AuthenticationStep, AuthenticationStepOutput } from '../step';
import type { AccountModel } from '../../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../../types/contexts';

/**
 * Validates that captcha provided by client is valid.
 *
 * @param authenticationContext		Current authentication context.
 *
 * @returns		Whether captcha is valid.
 */
type RecaptchaValidator = (authenticationContext: AuthenticationContext) => Promise<boolean>;

/**
 * @private
 */
class RecaptchaStep<Account extends AccountModel> implements AuthenticationStep<Account> {
	private readonly recaptchaValidator: RecaptchaValidator;

	public constructor(recaptchaValidator: RecaptchaValidator) {
		this.recaptchaValidator = recaptchaValidator;
	}

	public async process(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<AuthenticationStepOutput<Account>> {
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
