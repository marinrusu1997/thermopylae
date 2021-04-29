declare interface EmailSender {
	notifyMultiFactorAuthenticationFailed(emailAddress: string, ip: string, device: string): void;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyAccountDisabled(emailAddress: string, cause: string): void;
	/**
	 * Needs to be sent with high priority.
	 */
	notifyAuthenticationFromDifferentDevice(emailAddress: string, ip: string, device: string): void;
	sendActivateAccountLink(emailAddress: string, token: string): Promise<void>;
	sendForgotPasswordToken(emailAddress: string, token: string): Promise<void>;
}

declare interface SmsSender {
	sendTotpToken(telephone: string, token: string): Promise<void>;
	sendForgotPasswordToken(telephone: string, token: string): Promise<void>;
}

export { EmailSender, SmsSender };
