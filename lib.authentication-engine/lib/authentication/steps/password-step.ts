import { PasswordsManager } from '../../managers/passwords-manager';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { OnGoingAuthenticationSession } from '../../types/sessions';
import { AuthRequest } from '../../types/requests';

class PasswordStep implements AuthStep {
	private readonly passwordsManager: PasswordsManager;

	constructor(passwordsManager: PasswordsManager) {
		this.passwordsManager = passwordsManager;
	}

	async process(authRequest: AuthRequest, account: AccountModel, session: OnGoingAuthenticationSession): Promise<AuthStepOutput> {
		const passwordHash = {
			hash: account.password,
			salt: account.salt,
			alg: account.hashingAlg
		};

		if (!(await this.passwordsManager.isSame(authRequest.password!, passwordHash))) {
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