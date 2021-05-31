import { totp } from '@thermopylae/lib.utils';
import { AuthStep, AuthStepOutput } from '../auth-step';
import { AuthenticationContext } from '../../types/requests';
import { AccountModel } from '../../types/models';
import { AUTH_STEP } from '../../types/enums';
import { AuthenticationSession } from '../../types/sessions';
import { SmsSender } from '../../side-channels';

class GenerateTotpStep implements AuthStep {
	private readonly smsSender: SmsSender;

	private readonly totpManager: totp.Totp;

	constructor(smsSender: SmsSender, totpManager: totp.Totp) {
		this.smsSender = smsSender;
		this.totpManager = totpManager;
	}

	async process(_authRequest: AuthenticationContext, account: AccountModel, session: AuthenticationSession): Promise<AuthStepOutput> {
		const totpToken = this.totpManager.generate();
		session.mfaToken = totpToken; // save token for later verification
		await this.smsSender.sendTotpToken(account.telephone, totpToken);
		return { done: { nextStep: AUTH_STEP.TOTP } }; // partial successful authentication
	}
}

export { GenerateTotpStep };
