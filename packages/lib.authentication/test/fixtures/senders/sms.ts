import type { AccountWithTotpSecret, SmsSender } from '../../../lib/index.js';
import { SmsClientMock } from '../mocks/sms.js';

class SmsSenderMock implements SmsSender<AccountWithTotpSecret> {
	public readonly client: SmsClientMock;

	public constructor() {
		this.client = new SmsClientMock();
	}

	// oxlint-disable-next-line require-await
	public async sendForgotPasswordToken(account: AccountWithTotpSecret, token: string): Promise<void> {
		this.client.send(account.telephone ?? '', 'sendForgotPasswordToken', token);
	}
}

const SmsSenderInstance = new SmsSenderMock();
Object.freeze(SmsSenderInstance);

export { SmsSenderInstance };
