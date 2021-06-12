import { AuthenticationContext, ChangePasswordContext } from './contexts';
import { AccountModel } from './models';

interface EmailSender<Account extends AccountModel> {
	notifyMultiFactorAuthenticationFailed(account: Account, authenticationContext: AuthenticationContext): Promise<void>;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyAccountDisabled(account: Account, cause: string): Promise<void>;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyAdminAboutAccountDisabling(adminEmail: string, account: Account, cause: string): Promise<void>;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyPasswordChanged(account: Account, changePasswordContext: ChangePasswordContext): Promise<void>;
	sendActivateAccountToken(account: Account, token: string): Promise<void>;
	sendForgotPasswordToken(account: Account, token: string): Promise<void>;
}

interface SmsSender<Account extends AccountModel> {
	sendForgotPasswordToken(account: Account, token: string): Promise<void>;
}

export { EmailSender, SmsSender };
