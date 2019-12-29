import { http } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthSession } from '../models/sessions';
import { AuthNetworkInput } from '../types';
import { createException, ErrorCodes } from '../error';
import { AUTH_STEP } from '../enums';
import { Account } from '../models';

interface GoogleRecaptchaResponse {
	success: boolean;
}

class RecaptchaStep implements AuthStep {
	private readonly secret: string;

	constructor(secret: string) {
		this.secret = secret;
	}

	async process(networkInput: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStepOutput> {
		if (!networkInput.recaptcha) {
			throw createException(ErrorCodes.ARGUMENT_REQUIRED, 'Recaptcha is required', networkInput);
		}

		const response: GoogleRecaptchaResponse = await http.makeHTTPSRequest('https://google.com', {
			path: `/recaptcha/api/siteverify?secret=${this.secret}&response=${networkInput.recaptcha}&remoteip=${networkInput.ip}`
		});
		if (!response.success) {
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
