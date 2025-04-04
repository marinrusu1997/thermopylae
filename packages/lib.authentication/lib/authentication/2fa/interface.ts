import type { AuthenticationSessionRepositoryHolder } from '../../helpers/authentication-session-repository-holder.js';
import type { AuthenticationContext } from '../../types/contexts.js';
import type { AccountModel } from '../../types/models.js';

// @fixme implement 2fa with push notifications https://www.npmjs.com/package/node-pushnotifications

/** Represents 2 Factor Authentication strategy. */
interface TwoFactorAuthStrategy<Account extends AccountModel> {
	/**
	 * Hook used by strategy in order to attach metadata to account when multi factor auth is
	 * enabled.
	 *
	 * @param   account User account.
	 * @param   update  Fields that need to be updated on user account (e.g. totp secret).
	 *
	 * @returns         Result of the hook.
	 */
	onTwoFactorAuthEnabled(account: Readonly<Account>, update: Partial<Account>): Promise<Record<string, any> | null>;

	/**
	 * Send authentication token via side channel.
	 *
	 * @param account                               User account.
	 * @param authenticationContext                 Authentication context.
	 * @param authenticationSessionRepositoryHolder Authentication session repository holder.
	 */
	sendAuthenticationToken(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<void>;

	/**
	 * Verify 2FA authentication token.
	 *
	 * @param   account                               User account.
	 * @param   authenticationContext                 Authentication context.
	 * @param   authenticationSessionRepositoryHolder Authentication session repository holder.
	 *
	 * @returns                                       Whether token is valid.
	 */
	isAuthenticationTokenValid(
		account: Account,
		authenticationContext: AuthenticationContext,
		authenticationSessionRepositoryHolder: AuthenticationSessionRepositoryHolder
	): Promise<boolean>;
}

export type { TwoFactorAuthStrategy };
