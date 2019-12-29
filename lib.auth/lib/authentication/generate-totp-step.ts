// eslint-disable-next-line import/no-extraneous-dependencies
import { SMS } from '@marin/lib.sms/lib';
import { totp } from '@marin/lib.utils';
import { AuthStep, AuthStepOutput } from './auth-step';
import { AuthNetworkInput } from '../types';
import { Account } from '../models';
import { AUTH_STEP } from '../enums';

class GenerateTotpStep implements AuthStep {
	private readonly smsSender: SMS;
	private readonly totpManager: totp.Totp;

	constructor(totpManager: totp.Totp, smsSender: SMS) {
		this.totpManager = totpManager;
		this.smsSender = smsSender;
	}

	async process(_networkInput: AuthNetworkInput, account: Account): Promise<AuthStepOutput> {
		const totpToken = this.totpManager.generate();
		await this.smsSender.send(account.mobile, `Complete Multi Factor Authentication with this code: \n ${totpToken}`);
		return { done: AUTH_STEP.TOTP };
	}
}

export { GenerateTotpStep };
