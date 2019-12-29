// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
import { totp } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { logger } from '../logger';
import { AUTH_STEP } from '../enums';
import { sendNotificationMFAFailed } from '../utils/email';

class TotpStep implements AuthStep {
	private readonly totpManager: totp.Totp;
	private readonly mailer: Email;
	private readonly template: Function;

	constructor(totpManager: totp.Totp, mailer: Email, template: Function) {
		this.totpManager = totpManager;
		this.mailer = mailer;
		this.template = template;
	}

	async process(networkInput: AuthNetworkInput, account: Account): Promise<AuthStepOutput> {
		// totp is present, due to check in dispatcher
		if (!this.totpManager.check(networkInput.totp!, undefined, logger)) {
			sendNotificationMFAFailed(this.template, this.mailer, account.email, networkInput.ip, networkInput.device);
			return { nextStep: AUTH_STEP.ERROR };
		}
		return { nextStep: AUTH_STEP.AUTHENTICATED };
	}
}

export { TotpStep };
