import { PasswordsManager } from '../../managers/passwords-manager';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { AuthSession } from '../../types/sessions';
import { AuthRequest } from '../../types/requests';

class PasswordStep implements AuthStep {
	private readonly pepper: string;

	constructor(pepper: string) {
		this.pepper = pepper;
	}

	async process(networkInput: AuthRequest, account: AccountModel, session: AuthSession): Promise<AuthStepOutput> {
		if (!(await PasswordsManager.isCorrect(networkInput.password!, account.password, account.salt, this.pepper))) {
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

export { PasswordStep };
