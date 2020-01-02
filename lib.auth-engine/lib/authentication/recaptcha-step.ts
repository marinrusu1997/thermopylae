import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthSession } from '../models/sessions';
import { AuthNetworkInput } from '../types';
import { createException, ErrorCodes } from '../error';
import { AUTH_STEP } from '../enums';
import { Account } from '../models';

export type RecaptchaValidator = (recaptcha: string, remoteIp: string) => Promise<boolean>;

class RecaptchaStep implements AuthStep {
	private readonly recaptchaValidator: RecaptchaValidator;

	constructor(recaptchaValidator: RecaptchaValidator) {
		this.recaptchaValidator = recaptchaValidator;
	}

	async process(networkInput: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStepOutput> {
		if (!networkInput.recaptcha) {
			throw createException(ErrorCodes.ARGUMENT_REQUIRED, 'Recaptcha is required', networkInput);
		}

		if (!(await this.recaptchaValidator(networkInput.recaptcha, networkInput.ip))) {
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
