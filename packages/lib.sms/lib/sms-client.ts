import twilio, { Twilio } from 'twilio';
import { createException, ErrorCodes } from './error';

interface Options {
	accountSid: string;
	authToken: string;
	fromNumber: string;
}

class SmsClient {
	private readonly from: string;

	private readonly client: Twilio;

	constructor(options: Options) {
		this.from = options.fromNumber;
		this.client = twilio(options.accountSid, options.authToken);
	}

	public async send(to: string, body: string): Promise<string> {
		const message = await this.client.messages.create({ from: this.from, to, body });
		if (message.errorCode) {
			throw createException(ErrorCodes.SMS_DELIVERY_FAILED, message.errorMessage, message);
		}
		return message.sid;
	}
}

export { SmsClient, Options };
