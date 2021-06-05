import { SmsSender } from '../../../lib';
import { SmsClientMock } from '../mocks/sms';

class SmsSenderMock implements SmsSender {
	public readonly client: SmsClientMock;

	public constructor() {
		this.client = new SmsClientMock();
	}

	public async sendForgotPasswordToken(telephone: string, token: string): Promise<void> {
		this.client.send(telephone, 'sendForgotPasswordToken', token);
	}
}

const SmsSenderInstance = new SmsSenderMock();
Object.freeze(SmsSenderInstance);

export { SmsSenderInstance };
