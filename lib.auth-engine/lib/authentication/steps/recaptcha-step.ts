import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthSession } from '../../types/sessions';
import { AuthRequest } from '../../types/requests';
import { AUTH_STEP } from '../../types/enums';
import { AccountModel } from '../../types/models';

export type RecaptchaValidator = (recaptcha: string, remoteIp: string) => Promise<boolean>;

class RecaptchaStep implements AuthStep {
	private readonly recaptchaValidator: RecaptchaValidator;

	constructor(recaptchaValidator: RecaptchaValidator) {
		this.recaptchaValidator = recaptchaValidator;
	}

	async process(networkInput: AuthRequest, account: AccountModel, session: AuthSession): Promise<AuthStepOutput> {
		if (!networkInput.recaptcha) {
			return { nextStep: AUTH_STEP.ERROR };
		}

		if (!(await this.recaptchaValidator(networkInput.recaptcha, networkInput.ip))) {
			return { nextStep: AUTH_STEP.ERROR };
		}

		session.recaptchaRequired = false;
		if (account.usingMfa) {
			return { nextStep: AUTH_STEP.GENERATE_TOTP };
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED };
	}
}

export { RecaptchaStep };
