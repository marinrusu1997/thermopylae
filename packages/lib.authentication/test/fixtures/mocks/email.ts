import { EmailSender } from '../../../lib';

class EmailClientMock {
	private readonly outbox: Map<string, Map<keyof EmailSender, Array<string>>> = new Map();

	public deliveryWillFail = false;

	send(email: string, type: keyof EmailSender, message: string): void {
		if (this.deliveryWillFail) {
			throw new Error('Email client was configured to fail mail delivery');
		}

		let emailsByType = this.outbox.get(email);
		if (!emailsByType) {
			emailsByType = new Map();
			this.outbox.set(email, emailsByType);
		}

		let emails = emailsByType.get(type);
		if (emails == null) {
			emails = [];
			emailsByType.set(type, emails);
		}

		emails.push(message);
	}

	outboxFor(userEmail: string, type: keyof EmailSender): Array<string> {
		const emailsByType = this.outbox.get(userEmail);
		if (emailsByType == null) {
			return [];
		}
		return emailsByType.get(type) || [];
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
