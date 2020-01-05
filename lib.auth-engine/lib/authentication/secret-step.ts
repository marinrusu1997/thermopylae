import { PasswordsManager } from '../managers/passwords-manager';
import { AuthStep, AuthStepOutput } from './auth-step';
import { Account } from '../models';
import { AUTH_STEP } from '../enums';
import { AuthSession } from '../models/sessions';
import { AuthNetworkInput } from '../types';

class SecretStep implements AuthStep {
	private readonly pepper: string;

	constructor(pepper: string) {
		this.pepper = pepper;
	}

	async process(networkInput: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStepOutput> {
		if (!(await PasswordsManager.isCorrect(networkInput.password, account.password, account.salt, this.pepper))) {
			return { nextStep: AUTH_STEP.ERROR };
		}

		if (session.recaptchaRequired) {
			return { nextStep: AUTH_STEP.RECAPTCHA };
		}

		if (account.mfa) {
			return { nextStep: AUTH_STEP.GENERATE_TOTP };
		}

		return { nextStep: AUTH_STEP.AUTHENTICATED };
	}
}

export { SecretStep };
