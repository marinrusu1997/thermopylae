// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
import { totp } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { getLogger } from '../logger';
import { AUTH_STEP } from '../enums';
import { NotificationMFAFailedTemplate, sendNotificationMFAFailed } from '../utils/email';
import { AuthSession } from '../models/sessions';

class TotpStep implements AuthStep {
	private readonly totpManager: totp.Totp;
	private readonly mailer: Email;
	private readonly template: NotificationMFAFailedTemplate;

	constructor(totpManager: totp.Totp, mailer: Email, template: NotificationMFAFailedTemplate) {
		this.totpManager = totpManager;
		this.mailer = mailer;
		this.template = template;
	}

	async process(networkInput: AuthNetworkInput, account: Account, session: AuthSession): Promise<AuthStepOutput> {
		if (!session.mfaToken) {
			// received invalid token or someone is trying to use same token twice -> treat as error
			return { nextStep: AUTH_STEP.ERROR };
		}

		// after check is successful totp along with session will be deleted, thus preventing replay attacks
		if (!this.totpManager.check(networkInput.totp!, session.mfaToken, getLogger())) {
			sendNotificationMFAFailed(this.template, this.mailer, account.email, networkInput.ip, networkInput.device);
			return { nextStep: AUTH_STEP.ERROR };
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED };
	}
}

export { TotpStep };
