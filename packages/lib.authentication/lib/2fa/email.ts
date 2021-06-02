import { AuthenticationSessionRepositoryHolder } from '../sessions/authentication';
import { TwoFactorAuthAChannelType } from '../types/enums';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../types/models';
import type { AuthenticationContext } from '../types/contexts';

type SendEmailWithToken = (email: string, token: string) => Promise<void>;

interface EmailTwoFactorAuthStrategyOptions {
	readonly tokenLength: number;
	readonly sendEmail: SendEmailWithToken;
}

class EmailTwoFactorAuthStrategy implements TwoFactorAuthStrategy<AccountModel> {
	private readonly options: EmailTwoFactorAuthStrategyOptions;

	public constructor(options: EmailTwoFactorAuthStrategyOptions) {
		this.options = options;
	}

	public get type(): TwoFactorAuthAChannelType {
		return TwoFactorAuthAChannelType.EMAIL;
	}

	public async beforeRegister(): Promise<void> {
		return undefined;
	}

	public async sendToken(
		account: AccountModel,
		_authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<void> {
		const token = EmailTwoFactorAuthStrategy.getRandomNumber(this.options.tokenLength);
		const authenticationSession = await authenticationSessionRepositoryHolder.get();

		await this.options.sendEmail(account.email, token);
		authenticationSession['2fa-token'] = token;
	}

	public async isTokenValid(
		_account: AccountModel,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<boolean> {
		const authenticationSession = await authenticationSessionRepositoryHolder.get();

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

export { EmailTwoFactorAuthStrategy };
export type { EmailTwoFactorAuthStrategyOptions, SendEmailWithToken };
