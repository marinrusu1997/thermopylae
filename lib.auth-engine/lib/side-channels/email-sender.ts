// eslint-disable-next-line import/no-extraneous-dependencies
import { EmailClient, SentMessageInfo } from '@marin/lib.email';
import { getLogger } from '../logger';

declare type MultiFactorAuthenticationFailedNotificationHtmlTemplate = (data: { ip: string; device: string }) => string;
declare type AccountDisabledNotificationHtmlTemplate = (data: { cause: string }) => string;
declare type AuthenticationFromDifferentDeviceNotificationHtmlTemplate = (data: { ip: string; device: string }) => string;
declare type ActivateAccountHtmlTemplate = (data: { token: string }) => string;
declare type ForgotPasswordHtmlTemplate = (data: { token: string }) => string;

interface EmailSendOptions {
	multiFactorAuthenticationFailed: {
		subject?: string;
		htmlTemplate: MultiFactorAuthenticationFailedNotificationHtmlTemplate;
	};
	accountDisabled: {
		subject?: string;
		htmlTemplate: AccountDisabledNotificationHtmlTemplate;
	};
	authenticationFromDifferentDevice: {
		subject?: string;
		htmlTemplate: AuthenticationFromDifferentDeviceNotificationHtmlTemplate;
	};
	activateAccount: {
		subject?: string;
		htmlTemplate: ActivateAccountHtmlTemplate;
	};
	forgotPasswordToken: {
		subject?: string;
		htmlTemplate: ForgotPasswordHtmlTemplate;
	};
}

class EmailSender {
	private readonly emailClient: EmailClient;

	private readonly sendOptions: EmailSendOptions;

	constructor(emailClient: EmailClient, sendOptions: EmailSendOptions) {
		this.emailClient = emailClient;
		this.sendOptions = sendOptions;
	}

	public notifyMultiFactorAuthenticationFailed(emailAddress: string, ip: string, device: string): void {
		this.emailClient
			.send({
				to: emailAddress,
				subject: this.sendOptions.multiFactorAuthenticationFailed.subject || 'Authentication attempt using multi factor authentication failed',
				html: this.sendOptions.multiFactorAuthenticationFailed.htmlTemplate({ ip, device })
			})
			.catch(error => getLogger().error(`Failed to deliver multi factor auth failed notification to email address ${emailAddress}. `, error));
	}

	public notifyAccountDisabled(emailAddress: string, cause: string): void {
		this.emailClient
			.send({
				to: emailAddress,
				subject: this.sendOptions.accountDisabled.subject || 'Account has been disabled',
				html: this.sendOptions.accountDisabled.htmlTemplate({ cause }),
				priority: 'high'
			})
			.catch(error => getLogger().alert(`Failed to deliver account disabled notification to email address ${emailAddress}. `, error));
	}

	public notifyAuthenticationFromDifferentDevice(emailAddress: string, ip: string, device: string): void {
		this.emailClient
			.send({
				to: emailAddress,
				subject: this.sendOptions.authenticationFromDifferentDevice.subject || 'Authentication from different device',
				html: this.sendOptions.authenticationFromDifferentDevice.htmlTemplate({ ip, device }),
				priority: 'high'
			})
			.catch(error => getLogger().error(`Failed to deliver authentication from different device notification to email address ${emailAddress}. `, error));
	}

	public sendActivateAccountLink(emailAddress: string, token: string): Promise<SentMessageInfo> {
		return this.emailClient.send({
			to: emailAddress,
			subject: this.sendOptions.activateAccount.subject || 'Activate your account',
			html: this.sendOptions.activateAccount.htmlTemplate({ token })
		});
	}

	public sendForgotPasswordToken(emailAddress: string, token: string): Promise<SentMessageInfo> {
		return this.emailClient.send({
			to: emailAddress,
			subject: this.sendOptions.forgotPasswordToken.subject || 'Forgot password token',
			html: this.sendOptions.forgotPasswordToken.htmlTemplate({ token })
		});
	}
}

export {
	MultiFactorAuthenticationFailedNotificationHtmlTemplate,
	AccountDisabledNotificationHtmlTemplate,
	AuthenticationFromDifferentDeviceNotificationHtmlTemplate,
	ActivateAccountHtmlTemplate,
	ForgotPasswordHtmlTemplate,
	EmailSendOptions,
	EmailSender
};
