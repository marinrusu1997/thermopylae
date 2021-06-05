import { SmsSender } from '../../../lib';

class SmsClientMock {
	private readonly outbox: Map<string, Map<keyof SmsSender, Array<string>>> = new Map();

	public deliveryWillFail = false;

	send(to: string, type: keyof SmsSender, body: string): void {
		if (this.deliveryWillFail) {
			throw new Error('SMS mock client was configured to fail sms delivery');
		}

		let smsByType = this.outbox.get(to);
		if (!smsByType) {
			smsByType = new Map();
			this.outbox.set(to, smsByType);
		}

		let sms = smsByType.get(type);
		if (sms == null) {
			sms = [];
			smsByType.set(type, sms);
		}

		sms.push(body);
	}

	outboxFor(userTelephone: string, type: keyof SmsSender): Array<string> {
		const smsByType = this.outbox.get(userTelephone);
		if (smsByType == null) {
			return [];
		}
		return smsByType.get(type) || [];
	}

	clearOutboxFor(userTelephone: string): void {
		this.outbox.delete(userTelephone);
	}

	reset(): void {
		this.outbox.clear();
		this.deliveryWillFail = false;
	}
}

export { SmsClientMock };
