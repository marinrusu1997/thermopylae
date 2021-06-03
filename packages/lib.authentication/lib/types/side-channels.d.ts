import { AuthenticationContext, ChangePasswordContext } from './contexts';

declare interface EmailSender {
	notifyMultiFactorAuthenticationFailed(emailAddress: string, authenticationContext: AuthenticationContext): Promise<void>;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyAccountDisabled(emailAddress: string, cause: string): Promise<void>;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyAuthenticationFromDifferentDevice(emailAddress: string, authenticationContext: AuthenticationContext): Promise<void>;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyPasswordChanged(emailAddress: string, changePasswordContext: ChangePasswordContext): Promise<void>;
	sendActivateAccountToken(emailAddress: string, token: string): Promise<void>;
	sendForgotPasswordToken(emailAddress: string, token: string): Promise<void>;
}

export { EmailSender };
