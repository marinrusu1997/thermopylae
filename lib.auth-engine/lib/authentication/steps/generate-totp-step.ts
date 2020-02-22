import { totp } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthRequest } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { AuthSession } from '../../types/sessions';
import { SmsSender } from '../../side-channels/sms-sender';

class GenerateTotpStep implements AuthStep {
	private readonly smsSender: SmsSender;
	private readonly totpManager: totp.Totp;

	constructor(smsSender: SmsSender, totpManager: totp.Totp) {
		this.smsSender = smsSender;
		this.totpManager = totpManager;
	}

	async process(_networkInput: AuthRequest, account: AccountModel, session: AuthSession): Promise<AuthStepOutput> {
		const totpToken = this.totpManager.generate();
		session.mfaToken = totpToken; // save token for later verification
		await this.smsSender.sendTotpToken(account.telephone, totpToken);
		return { done: { nextStep: AUTH_STEP.TOTP } }; // partial successful authentication
	}
}

export { GenerateTotpStep };
