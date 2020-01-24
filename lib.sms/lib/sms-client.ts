import twilio, { Twilio } from 'twilio';
import { createException, ErrorCodes } from './error';

interface Options {
	accountSid: string;
	authToken: string;
	fromNumber: string;
}

class SmsClient {
	private from: string | undefined;

	private client: Twilio | undefined;

	public init(options: Options): void {
		if (this.client) {
			throw createException(ErrorCodes.SMS_CLIENT_ALREADY_INITIALIZED, '');
		}
		this.from = options.fromNumber;
		this.client = twilio(options.accountSid, options.authToken);
	}

	public async send(to: string, sms: string): Promise<string> {
		if (!this.client) {
			throw createException(ErrorCodes.SMS_CLIENT_NOT_INITIALIZED, '');
		}
		const message = await this.client.messages.create({ from: this.from, to, body: sms });
		if (message.errorCode) {
			throw createException(ErrorCodes.SMS_DELIVERY_FAILED, message.errorMessage, message);
		}
		return message.sid;
	}
}

export { SmsClient, Options };
