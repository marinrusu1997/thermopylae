import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../../types/models';
import type { AuthenticationContext } from '../../types/contexts';
import { createException, ErrorCodes } from '../../error';

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

	public async onTwoFactorAuthEnabled(): Promise<null> {
		return null;
	}

	public async sendAuthenticationToken(
		account: AccountModel,
		_authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<void> {
		const authenticationSession = await authenticationSessionRepositoryHolder.get();
		if (authenticationSession['2fa-token'] != null) {
			throw createException(
				ErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY,
				`Two factor authentication token was issued already for authentication session with id '${authenticationSessionRepositoryHolder.sessionId}' belonging to account with id '${account.id}'.`
			);
		}

		const token = EmailTwoFactorAuthStrategy.getRandomNumber(this.options.tokenLength);

		await this.options.sendEmail(account.email, token);
		authenticationSession['2fa-token'] = token;
	}

	public async isAuthenticationTokenValid(
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