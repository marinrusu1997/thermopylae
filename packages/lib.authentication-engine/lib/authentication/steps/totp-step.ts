import { totp } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { getLogger } from '../../logger';
import { AUTH_STEP } from '../../types/enums';
import { EmailSender } from '../../side-channels/email-sender';
import { OnGoingAuthenticationSession } from '../../types/sessions';

class TotpStep implements AuthStep {
	private readonly emailSender: EmailSender;

	private readonly totpManager: totp.Totp;

	constructor(emailSender: EmailSender, totpManager: totp.Totp) {
		this.emailSender = emailSender;
		this.totpManager = totpManager;
	}

	async process(authRequest: AuthRequest, account: AccountModel, session: OnGoingAuthenticationSession): Promise<AuthStepOutput> {
		if (!session.mfaToken) {
			// received invalid token or someone is trying to use same token twice -> treat as error
			return { nextStep: AUTH_STEP.ERROR };
		}

		// after check is successful totp along with session will be deleted, thus preventing replay attacks
		if (!this.totpManager.check(authRequest.totp!, session.mfaToken, getLogger())) {
			this.emailSender.notifyMultiFactorAuthenticationFailed(account.email, authRequest.ip, authRequest.device);
			return { nextStep: AUTH_STEP.ERROR };
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED };
	}
}

export { TotpStep };
