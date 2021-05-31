import { AuthenticationSessionRepositoryHolder } from '../sessions/authentication';
import { TwoFactorAuthAChannel } from '../types/enums';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../types/models';
import type { AuthenticationContext } from '../types/requests';

type SendSmsWithTotpToken = (telephone: string, token: string) => Promise<void>;

interface SmsTwoFactorAuthStrategyOptions {
	readonly tokenLength: number;
	readonly sendSms: SendSmsWithTotpToken;
}

class SmsTwoFactorAuthStrategy implements TwoFactorAuthStrategy<AccountModel> {
	private readonly options: SmsTwoFactorAuthStrategyOptions;

	public constructor(options: SmsTwoFactorAuthStrategyOptions) {
		this.options = options;
	}

	public get type(): TwoFactorAuthAChannel {
		return TwoFactorAuthAChannel.SMS;
	}

	public async beforeRegister(): Promise<void> {
		return undefined;
	}

	public async sendToken(
		account: AccountModel,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<void> {
		const token = SmsTwoFactorAuthStrategy.getRandomNumber(this.options.tokenLength);
		const authenticationSession = await authenticationSessionRepositoryHolder.get(account.username, authenticationContext.deviceId);

		await this.options.sendSms(account.telephone!, token);
		authenticationSession['2fa-token'] = token;
	}

	public async verifyToken(
		account: AccountModel,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<boolean> {
		const authenticationSession = await authenticationSessionRepositoryHolder.get(account.username, authenticationContext.deviceId);

		if (authenticationContext['2fa-token'] === authenticationSession['2fa-token']) {
			delete authenticationSession['2fa-token']; // prevent replay attacks
			return true;
		}

		return false;
	}

	private static getRandomNumber(digit: number): string {
		return Math.random().toFixed(digit).substr(2); // 0.
	}
}

export { SmsTwoFactorAuthStrategy };
export type { SmsTwoFactorAuthStrategyOptions, SendSmsWithTotpToken };
