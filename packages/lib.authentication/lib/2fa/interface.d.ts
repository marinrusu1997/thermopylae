import type { AccountModel } from '../types/models';

/**
 * Represents 2 Factor Authentication strategy.
 */
interface TwoFactorAuthStrategy<Account extends AccountModel> {
	/**
	 * Hook used by strategy in order to attach metadata to account before it's registered.
	 *
	 * @param account	User account.
	 */
	beforeRegister(account: Account): Promise<void>;

	/**
	 * Send token via side channel.
	 *
	 * @param account	User account.
	 */
	sendToken(account: Account): Promise<void>;

	/**
	 * Verify 2FA token.
	 *
	 * @param account	User account.
	 * @param token     Token sent by user.
	 *
	 * @returns         Whether token is valid.
	 */
	verifyToken(account: Account, token: string): Promise<boolean>;
}
