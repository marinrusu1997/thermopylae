// eslint-disable-next-line import/no-extraneous-dependencies
import { SMS } from '@marin/lib.sms';
import { totp } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { AUTH_STEP } from '../enums';

type TotpSmsTemplate = (totpToken: string) => string;

class GenerateTotpStep implements AuthStep {
	private readonly smsSender: SMS;
	private readonly totpManager: totp.Totp;
	private readonly template: TotpSmsTemplate;

	constructor(totpManager: totp.Totp, smsSender: SMS, template: TotpSmsTemplate) {
		this.smsSender = smsSender;
		this.totpManager = totpManager;
		this.template = template;
	}

	async process(_networkInput: AuthNetworkInput, account: Account): Promise<AuthStepOutput> {
		const totpToken = this.totpManager.generate();
		await this.smsSender.send(account.telephone, this.template(totpToken));
		return { done: { nextStep: AUTH_STEP.TOTP } }; // partial successful authentication
	}
}

export { GenerateTotpStep };
