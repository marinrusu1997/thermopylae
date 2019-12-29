// eslint-disable-next-line import/no-extraneous-dependencies
import { Email } from '@marin/lib.email';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SentMessageInfo } from '@marin/lib.email/dist/types';
import { logger } from '../logger';
import { Id } from '../types';

function sendNotificationMFAFailed(template: Function, mailer: Email, email: string, ip: string, device: string): void {
	mailer
		.send(
			{
				to: email,
				subject: 'Authentication attempt using multi factor authentication failed',
				html: template({ ip, device })
			},
			true
		)
		.catch((error: Error) => logger.error(`Failed to deliver mfa failed notification to ${email}`, error));
}

function sendNotificationAccountLockedToUserEmail(template: Function, mailer: Email, email: string, cause?: string): void {
	mailer
		.send(
			{
				to: email,
				subject: 'Account has been locked',
				html: template({ cause })
			},
			true
		)
		.catch((error: Error) => logger.error(`Failed to deliver mfa failed notification to ${email}`, error));
}

function sendNotificationAccountLockedToAdminEmail(mailer: Email, email: string, accountId: Id, cause?: string): Promise<SentMessageInfo> {
	return mailer.send({ to: email, subject: `Account ${accountId} was locked.`, text: `Cause: ${cause}.` }, true);
}

function sendNotificationAuthFromDifferentDevice(template: Function, mailer: Email, email: string, ip: string, device: string): void {
	mailer
		.send(
			{
				to: email,
				subject: 'Authentication from different device',
				html: template({ ip, device })
			},
			true
		)
		.catch((error: Error) => logger.error(`Failed to deliver auth from different device notification to ${email}`, error));
}

export {
	sendNotificationMFAFailed,
	sendNotificationAccountLockedToUserEmail,
	sendNotificationAccountLockedToAdminEmail,
	sendNotificationAuthFromDifferentDevice
};
