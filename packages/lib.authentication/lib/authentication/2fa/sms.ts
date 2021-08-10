import { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder';
import type { TwoFactorAuthStrategy } from './interface';
import type { AccountModel } from '../../types/models';
import type { AuthenticationContext } from '../../types/contexts';
import { createException, ErrorCodes } from '../../error';

/**
 * Send sms containing two factor authentication token to user.
 *
 * @param telephone		User telephone.
 * @param token			Two factor authentication token.
 */
type SendSmsWithToken = (telephone: string, token: string) => Promise<void>;

interface SmsTwoFactorAuthStrategyOptions {
	/**
	 * Two factor authentication token length.
	 */
	readonly tokenLength: number;
	/**
	 * Two factor authentication token sms sender.
	 */
	readonly sendSms: SendSmsWithToken;
}

/**
 * Two factor authentication strategy which sends token to user via sms. <br/>
 * Generated token is stored in the {@link AuthenticationSession.twoFactorAuthenticationToken} property
 * and is valid until {@link AuthenticationSession} expires or token is send by client and validated.
 */
class SmsTwoFactorAuthStrategy implements TwoFactorAuthStrategy<AccountModel> {
	private readonly options: SmsTwoFactorAuthStrategyOptions;

	public constructor(options: SmsTwoFactorAuthStrategyOptions) {
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
		if (authenticationSession.twoFactorAuthenticationToken != null) {
			throw createException(
				ErrorCodes.TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY,
				`Two factor authentication token was issued already for authentication session with id '${authenticationSessionRepositoryHolder.sessionId}' belonging to account with id '${account.id}'.`
			);
		}

		const token = SmsTwoFactorAuthStrategy.getRandomNumber(this.options.tokenLength);

		await this.options.sendSms(account.telephone!, token);
		authenticationSession.twoFactorAuthenticationToken = token;
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

		if (authenticationContext.twoFactorAuthenticationToken === authenticationSession.twoFactorAuthenticationToken) {
			delete authenticationSession.twoFactorAuthenticationToken; // prevent replay attacks
			return true;
		}

		return false;
	}

	private static getRandomNumber(digit: number): string {
		return Math.random().toFixed(digit).substr(2); // 0.
	}
}

export { SmsTwoFactorAuthStrategy };
export type { SmsTwoFactorAuthStrategyOptions, SendSmsWithToken };
