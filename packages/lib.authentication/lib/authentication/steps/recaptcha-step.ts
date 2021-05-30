import { AuthStep, AuthStepOutput } from '../auth-step';
import { OnGoingAuthenticationSession } from '../../types/sessions';
import { AuthRequest } from '../../types/requests';
import { AUTH_STEP } from '../../types/enums';
import { AccountModel } from '../../types/models';

export type RecaptchaValidator = (recaptcha: string, remoteIp: string) => Promise<boolean>;

class RecaptchaStep implements AuthStep {
	private readonly recaptchaValidator: RecaptchaValidator;

	constructor(recaptchaValidator: RecaptchaValidator) {
		this.recaptchaValidator = recaptchaValidator;
	}

	async process(authRequest: AuthRequest, account: AccountModel, session: OnGoingAuthenticationSession): Promise<AuthStepOutput> {
		if (!authRequest.recaptcha) {
			return { nextStep: AUTH_STEP.ERROR };
		}

		if (!(await this.recaptchaValidator(authRequest.recaptcha, authRequest.ip))) {
			return { nextStep: AUTH_STEP.ERROR };
		}

		session.recaptchaRequired = false;
		if (account.mfa) {
			return { nextStep: AUTH_STEP.GENERATE_TOTP };
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED };
	}
}

export { RecaptchaStep };
