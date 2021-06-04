class EmailClientMock {
	private readonly outbox: Map<string, Array<string>> = new Map<string, Array<string>>();

	public deliveryWillFail = false;

	async send(email: string, message: string): Promise<void> {
		if (this.deliveryWillFail) {
			throw new Error('Email client was configured to fail mail delivery');
		}

		const emails = this.outbox.get(email);
		if (!emails) {
			this.outbox.set(email, [message]);
		} else {
			emails.push(message);
		}
	}

	outboxFor(userEmail: string): Array<string> {
		return this.outbox.get(userEmail) || [];
	}

	clearOutboxFor(userEmail: string): void {
		this.outbox.delete(userEmail);
	}

	reset(): void {
		this.outbox.clear();
		this.deliveryWillFail = false;
	}
}

export { EmailClientMock };
