import { AuthenticationContext, ChangePasswordContext } from './contexts';
import { AccountModel } from './models';

/**
 * Sender used in order to notify client via email about different events
 * happened in the authentication process and account management.
 */
interface EmailSender<Account extends AccountModel> {
	/**
	 * Notify user about failure of the multi factor authentication. <br/>
	 * In case attacker guesses password, it will fail at mfa.
	 * User will be notified about this, and in case it wasn't him that failed mfa, he needs to be suggested to change password.
	 *
	 * @param account					Account on which failed mfa was detected.
	 * @param authenticationContext		Authentication context.
	 */
	notifyMultiFactorAuthenticationFailed(account: Account, authenticationContext: AuthenticationContext): Promise<void>;

	/**
	 * Notify user that his account has been disabled. <br/>
	 * Usually account will be disabled because of too many failed authentication attempts or explicitly by the admin.
	 *
	 * @param account	Account that has been disabled.
	 * @param cause		Explanatory message containing reason why account has been disabled.
	 */
	notifyAccountDisabled(account: Account, cause: string): Promise<void>;

	/**
	 * Notify admin that user account has been disabled. <br/>
	 * Usually account will be disabled because of too many failed authentication attempts or explicitly by the admin.
	 *
	 * @param adminEmail	Email of the admin.
	 * @param account		Account that has been disabled.
	 * @param cause			Explanatory message containing reason why account has been disabled.
	 */
	notifyAdminAboutAccountDisabling(adminEmail: string, account: Account, cause: string): Promise<void>;

	/**
	 * Notify user that password of his account has been changed. <br/>
	 * In case attacker guesses his password or steals his session, user will receive this notification. <br/>
	 * User needs to be suggested to change password/recover account/enable mfa in case he doesn't recognize this password change attempt.
	 *
	 * @param account					Account on which password has been changed.
	 * @param changePasswordContext		Change password context.
	 */
	notifyPasswordChanged(account: Account, changePasswordContext: ChangePasswordContext): Promise<void>;

	/**
	 * Send account activation token to user after he registered his account.
	 *
	 * @param account		Account that needs to be activated.
	 * @param token			Activate account token.
	 */
	sendActivateAccountToken(account: Account, token: string): Promise<void>;

	/**
	 * Send forgot password token to user after he started account recovery procedure.
	 *
	 * @param account		Account that needs to be recovered.
	 * @param token			Forgot password token.
	 * @param isEncrypted	Whether token was encrypted with {@link AccountModel.pubKey}.
	 */
	sendForgotPasswordToken(account: Account, token: string, isEncrypted: boolean): Promise<void>;
}

/**
 * Sender used in order to notify client via sms about different events
 * happened in the authentication process and account management.
 */
interface SmsSender<Account extends AccountModel> {
	/**
	 * Send forgot password token to user after he started account recovery procedure.
	 *
	 * @param account		Account that needs to be recovered.
	 * @param token			Forgot password token.
	 * @param isEncrypted	Whether token was encrypted with {@link AccountModel.pubKey}.
	 */
	sendForgotPasswordToken(account: Account, token: string, isEncrypted: boolean): Promise<void>;
}

export { EmailSender, SmsSender };
