import { PasswordsManager } from '../../managers/passwords-manager';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { OnGoingAuthenticationSession } from '../../types/sessions';
import { AuthRequest } from '../../types/requests';

class PasswordStep implements AuthStep {
	private readonly pepper: string;

	constructor(pepper: string) {
		this.pepper = pepper;
	}

	async process(authRequest: AuthRequest, account: AccountModel, session: OnGoingAuthenticationSession): Promise<AuthStepOutput> {
		if (!(await PasswordsManager.isCorrect(authRequest.password!, account.password, account.salt, this.pepper))) {
			return { nextStep: AUTH_STEP.ERROR };
		}

		if (session.recaptchaRequired) {
			return { nextStep: AUTH_STEP.RECAPTCHA };
		}

		if (account.usingMfa) {
			return { nextStep: AUTH_STEP.GENERATE_TOTP };
		}

		return { nextStep: AUTH_STEP.AUTHENTICATED };
	}
}

export { PasswordStep };
