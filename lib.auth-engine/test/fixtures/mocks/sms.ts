import { SmsClient, ErrorCodes as SmsErrorCodes } from '@marin/lib.sms';
import { createException } from '../../../lib/error';

class SmsMock extends SmsClient {
	private readonly outbox: Map<string, Array<string>> = new Map<string, Array<string>>();
	private deliveryFails = false;

	async send(to: string, body: string): Promise<string> {
		if (this.deliveryFails) {
			throw createException(SmsErrorCodes.SMS_DELIVERY_FAILED, 'SMS mock client was configured to fail sms delivery');
		}

		const sms = this.outbox.get(to);
		if (!sms) {
			this.outbox.set(to, [body]);
		} else {
			sms.push(body);
		}
		return '';
	}

	deliveryWillFail(flag: boolean): void {
		this.deliveryFails = flag;
	}

	outboxFor(userTelephone: string): Array<string> {
		return this.outbox.get(userTelephone) || [];
	}

	clearOutboxFor(userTelephone: string): void {
		this.outbox.delete(userTelephone);
	}

	reset(): void {
		this.outbox.clear();
		this.deliveryFails = false;
	}
}

const instance = new SmsMock();
export { instance as SmsMockInstance, SmsMock };
