import { PasswordsManager } from '../../managers/passwords-manager';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { AuthenticationSession } from '../../types/sessions';
import { AuthenticationContext } from '../../types/requests';

class PasswordStep implements AuthStep {
	private readonly passwordsManager: PasswordsManager;

	constructor(passwordsManager: PasswordsManager) {
		this.passwordsManager = passwordsManager;
	}

	async process(authRequest: AuthenticationContext, account: AccountModel, session: AuthenticationSession): Promise<AuthStepOutput> {
		const passwordHash = {
			hash: account.password,
			salt: account.salt,
			alg: account.alg
		};

		if (!(await this.passwordsManager.isSame(authRequest.password!, passwordHash))) {
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
