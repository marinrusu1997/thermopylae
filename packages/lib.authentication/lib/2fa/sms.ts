import type { AccountModel } from '../types/models';
import { TotpBaseTwoFactorAuthStrategy, TotpBaseTwoFactorAuthStrategyOptions } from './totp-base';

type SendSmsWithTotpToken = (telephone: string, token: string) => Promise<void>;

interface AccountWithTotpSecret extends AccountModel {
	totpSecret: string;
}

interface SmsTwoFactorAuthStrategyOptions {
	readonly totp: TotpBaseTwoFactorAuthStrategyOptions;
	readonly sendSms: SendSmsWithTotpToken;
}

class SmsTwoFactorAuthStrategy<Account extends AccountWithTotpSecret> extends TotpBaseTwoFactorAuthStrategy<Account> {
	private readonly sendSms: SendSmsWithTotpToken;

	public constructor(options: SmsTwoFactorAuthStrategyOptions) {
		super(options.totp);
		this.sendSms = options.sendSms;
	}

	public async sendToken(account: Account): Promise<void> {
		await this.sendSms(account.telephone, this.authenticator.generate(this.getTotpSecret(account)));
	}

	public async verifyToken(account: Account, token: string): Promise<boolean> {
		return this.authenticator.check(token, this.getTotpSecret(account));
	}
}

export { SmsTwoFactorAuthStrategy };
export type { SmsTwoFactorAuthStrategyOptions, AccountWithTotpSecret, SendSmsWithTotpToken };
