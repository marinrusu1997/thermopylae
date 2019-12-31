import { Email, SentMessageInfo, SendMailOptions } from '@marin/lib.email';
import { createException, ErrorCodes } from '../../lib/error';

class EmailMock extends Email {
	private outbox: Map<string, Array<SendMailOptions>> = new Map<string, SendMailOptions>();
	private failEmailDelivery = false;

	async send(message: SendMailOptions): Promise<SentMessageInfo> {
		if (this.failEmailDelivery) {
			throw createException(ErrorCodes.NOT_DELIVERED, 'Email client was configured to fail mail delivery');
		}

		const emails = this.outbox.get(message.to);
		if (!emails) {
			this.outbox.set(message.to, [message]);
		} else {
			emails.push(message);
		}
		return {};
	}

	outboxFor(userEmail: string): Array<SendMailOptions> {
		return this.outbox.get(userEmail) || [];
	}

	clearOutboxFor(userEmail: string): void {
		this.outbox.delete(userEmail);
	}

	clearOutbox(): void {
		this.outbox.clear();
	}

	emailDeliveryIsFailing(flag: boolean) {
		this.failEmailDelivery = flag;
	}
}

const instance = new EmailMock();
export default instance;
