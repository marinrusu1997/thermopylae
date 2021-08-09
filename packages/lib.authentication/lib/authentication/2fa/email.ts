import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../../types/models';
import type { AuthenticationContext } from '../../types/contexts';
import { createException, ErrorCodes } from '../../error';

/**
 * Send email containing two factor authentication token to user.
 *
 * @param email		User email.
 * @param token		Two factor authentication token.
 */
type SendEmailWithToken = (email: string, token: string) => Promise<void>;

interface EmailTwoFactorAuthStrategyOptions {
	/**
	 * Two factor authentication token length.
	 */
	readonly tokenLength: number;
	/**
	 * Two factor authentication token email sender.
	 */
	readonly sendEmail: SendEmailWithToken;
}

/**
 * Two factor authentication strategy which sends token to user via email. <br/>
 * Generated token is stored in the {@link AuthenticationSession['2fa-token']} property
 * and is valid until {@link AuthenticationSession} expires or token is send by client and validated.
 */
class EmailTwoFactorAuthStrategy implements TwoFactorAuthStrategy<AccountModel> {
	private readonly options: EmailTwoFactorAuthStrategyOptions;

	public constructor(options: EmailTwoFactorAuthStrategyOptions) {
		this.options = options;
	}

	/**
	 * @inheritDoc
	 */
	public async onTwoFactorAuthEnabled(): Promise<null> {
		return null;
	}

	/**
	 * @inheritDoc
	 */
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

	/**
	 * @inheritDoc
	 */
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
