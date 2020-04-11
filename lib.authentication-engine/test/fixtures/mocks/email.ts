import { EmailClient, SentMessageInfo, SendMailOptions, ErrorCodes as EmailErrorCodes } from '@marin/lib.email';
import { createException } from '../../../lib/error';

class EmailMock extends EmailClient {
	private readonly outbox: Map<string, Array<SendMailOptions>> = new Map<string, Array<SendMailOptions>>();

	private failEmailDelivery = false;

	async send(message: SendMailOptions): Promise<SentMessageInfo> {
		if (this.failEmailDelivery) {
			throw createException(EmailErrorCodes.EMAIL_DELIVERY_FAILED, 'Email client was configured to fail mail delivery');
		}

		const emails = this.outbox.get(message.to as string);
		if (!emails) {
			this.outbox.set(message.to as string, [message]);
		} else {
			emails.push(message);
		}
		// @ts-ignore
		return {};
	}

	outboxFor(userEmail: string): Array<SendMailOptions> {
		return this.outbox.get(userEmail) || [];
	}

	clearOutboxFor(userEmail: string): void {
		this.outbox.delete(userEmail);
	}

	reset(): void {
		this.outbox.clear();
		this.failEmailDelivery = false;
	}

	deliveryWillFail(flag = true): void {
		this.failEmailDelivery = flag;
	}
}

const instance = new EmailMock({}, {});
export { instance as EmailMockInstance, EmailMock };
