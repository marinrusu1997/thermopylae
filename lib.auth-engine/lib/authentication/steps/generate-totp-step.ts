// eslint-disable-next-line import/no-extraneous-dependencies
import { SmsClient } from '@marin/lib.sms';
import { totp } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { AuthSession } from '../../types/sessions';

type TotpSmsTemplate = (totpToken: string) => string;

class GenerateTotpStep implements AuthStep {
	private readonly smsSender: SmsClient;
	private readonly totpManager: totp.Totp;
	private readonly template: TotpSmsTemplate;

	constructor(totpManager: totp.Totp, smsSender: SmsClient, template: TotpSmsTemplate) {
		this.smsSender = smsSender;
		this.totpManager = totpManager;
		this.template = template;
	}

	async process(_networkInput: AuthRequest, account: AccountModel, session: AuthSession): Promise<AuthStepOutput> {
		const totpToken = this.totpManager.generate();
		session.mfaToken = totpToken; // save token for later verification
		await this.smsSender.send(account.telephone, this.template(totpToken));
		return { done: { nextStep: AUTH_STEP.TOTP } }; // partial successful authentication
	}
}

export { GenerateTotpStep };
