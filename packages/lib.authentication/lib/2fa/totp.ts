import { TotpBaseTwoFactorAuthStrategy } from './totp-base';
import { AccountWithTotpSecret } from './sms';

class TotpTwoFactorAuthStrategy<Account extends AccountWithTotpSecret> extends TotpBaseTwoFactorAuthStrategy<Account> {
	sendToken(account: Account): Promise<void> {
		return Promise.resolve(undefined);
	}

	verifyToken(account: Account, token: string): Promise<boolean> {
		return Promise.resolve(false);
	}
}

export { TotpTwoFactorAuthStrategy };
