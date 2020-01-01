import { SMS } from '@marin/lib.sms';
import { createException, ErrorCodes } from '../../../lib/error';

class SmsMock extends SMS {
	private readonly outbox: Map<string, Array<string>> = new Map<string, Array<string>>();
	private deliveryFails = false;

	async send(to: string, body: string): Promise<string> {
		if (this.deliveryFails) {
			throw createException(ErrorCodes.NOT_DELIVERED, 'SMS mock client was configured to fail sms delivery');
		}

		const sms = this.outbox.get(to);
		if (!sms) {
			this.outbox.set(to, [body]);
		} else {
			sms.push(body);
		}
		return '';
	}

	deliveryWillFail(flag: boolean) {
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
		this.deliveryFails = true;
	}
}

const instance = new SmsMock();
export { instance as SmsMockInstance, SmsMock };
