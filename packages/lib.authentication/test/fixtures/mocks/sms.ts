class SmsClientMock {
	private readonly outbox: Map<string, Array<string>> = new Map<string, Array<string>>();

	public deliveryWillFail = false;

	async send(to: string, body: string): Promise<void> {
		if (this.deliveryWillFail) {
			throw new Error('SMS mock client was configured to fail sms delivery');
		}

		const sms = this.outbox.get(to);
		if (!sms) {
			this.outbox.set(to, [body]);
		} else {
			sms.push(body);
		}
	}

	outboxFor(userTelephone: string): Array<string> {
		return this.outbox.get(userTelephone) || [];
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
