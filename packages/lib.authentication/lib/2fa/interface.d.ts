import type { AccountModel } from '../types/models';
import type { AuthenticationSessionRepositoryHolder } from '../helpers/authentication-session-repository-holder';
import type { AuthenticationContext } from '../types/contexts';

/**
 * Represents 2 Factor Authentication strategy.
 */
interface TwoFactorAuthStrategy<Account extends AccountModel> {
	/**
	 * Hook used by strategy in order to attach metadata to account before it's registered.
	 *
	 * @param account				User account.
	 * @param registerResponse		Response that will be sent to user after registration.
	 */
	beforeRegister(account: Account, registerResponse: Record<string, any>): Promise<void>;

	/**
	 * Send token via side channel.
	 *
	 * @param account									User account.
	 * @param authenticationContext						Authentication context.
	 * @param authenticationSessionRepositoryHolder		Authentication session repository holder.
	 */
	sendToken(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<void>;

	/**
	 * Verify 2FA token.
	 *
	 * @param account									User account.
	 * @param authenticationContext						Authentication context.
	 * @param authenticationSessionRepositoryHolder		Authentication session repository holder.
	 *
	 * @returns         								Whether token is valid.
	 */
	isTokenValid(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<boolean>;
}

export type { TwoFactorAuthStrategy };
