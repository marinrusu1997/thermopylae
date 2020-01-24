// eslint-disable-next-line import/no-extraneous-dependencies
import { EmailClient, SentMessageInfo } from '@marin/lib.email';
import { getLogger } from './logger';

declare type NotificationMFAFailedTemplate = (data: { ip: string; device: string }) => string;
declare type NotificationAccountLockedTemplate = (data: { cause: string }) => string;
declare type NotificationAuthFromDiffDeviceTemplate = (data: { ip: string; device: string }) => string;
declare type ActivateAccountTemplate = (data: { token: string }) => string;
declare type ForgotPasswordTemplate = (data: { token: string }) => string;

function sendNotificationMFAFailed(template: NotificationMFAFailedTemplate, mailer: EmailClient, email: string, ip: string, device: string): void {
	mailer
		.send(
			{
				to: email,
				subject: 'Authentication attempt using multi factor authentication failed',
				html: template({ ip, device })
			},
			true
		)
		.catch((error: Error) => getLogger().error(`Failed to deliver mfa failed notification to ${email}`, error));
}

function sendNotificationAccountLockedToUserEmail(template: NotificationAccountLockedTemplate, mailer: EmailClient, email: string, cause: string): void {
	mailer
		.send(
			{
				to: email,
				subject: 'Account has been locked',
				html: template({ cause })
			},
			true
		)
		.catch((error: Error) => getLogger().error(`Failed to deliver mfa failed notification to ${email}`, error));
}

function sendNotificationAccountLockedToAdminEmail(mailer: EmailClient, email: string, accountId: string, cause: string): Promise<SentMessageInfo> {
	return mailer.send({ to: email, subject: `Account ${accountId} was locked.`, text: `Cause: ${cause}.` }, true);
}

function sendNotificationAuthFromDifferentDevice(
	template: NotificationAuthFromDiffDeviceTemplate,
	mailer: EmailClient,
	email: string,
	ip: string,
	device: string
): void {
	mailer
		.send(
			{
				to: email,
				subject: 'Authentication from different device',
				html: template({ ip, device })
			},
			true
		)
		.catch((error: Error) => getLogger().error(`Failed to deliver auth from different device notification to ${email}`, error));
}

function sendActivateAccountLinkToUserEmail(template: ActivateAccountTemplate, mailer: EmailClient, email: string, token: string): Promise<SentMessageInfo> {
	return mailer.send({ to: email, subject: 'Activate your account', html: template({ token }) }, true);
}

function sendForgotPasswordTokenToUserEmail(template: ForgotPasswordTemplate, mailer: EmailClient, email: string, token: string): Promise<SentMessageInfo> {
	return mailer.send({ to: email, subject: 'Forgot password token', html: template({ token }) }, true);
}

export {
	// eslint-disable-next-line no-undef
	NotificationMFAFailedTemplate,
	// eslint-disable-next-line no-undef
	NotificationAccountLockedTemplate,
	// eslint-disable-next-line no-undef
	NotificationAuthFromDiffDeviceTemplate,
	// eslint-disable-next-line no-undef
	ActivateAccountTemplate,
	// eslint-disable-next-line no-undef
	ForgotPasswordTemplate,
	sendNotificationMFAFailed,
	sendNotificationAccountLockedToUserEmail,
	sendNotificationAccountLockedToAdminEmail,
	sendNotificationAuthFromDifferentDevice,
	sendActivateAccountLinkToUserEmail,
	sendForgotPasswordTokenToUserEmail
};
