import twilio, { Twilio } from 'twilio';
import { createException, ErrorCodes } from './error';

interface SmsClientOptions {
	/**
	 * Account SID from [Twilio Console](https://www.twilio.com/console).
	 */
	accountSid: string;
	/**
	 * Authentication Token from [Twilio Console](https://www.twilio.com/console).
	 */
	authToken: string;
	/**
	 * Telephone number from SMS will be sent.
	 */
	fromNumber: string;
}

/**
 * Class used for SMS sending. <br/>
 * SMS are sent by [twilio](https://www.npmjs.com/package/twilio "Twilio").
 */
class SmsClient {
	private readonly from: string;

	private readonly client: Twilio;

	public constructor(options: SmsClientOptions) {
		this.from = options.fromNumber;
		this.client = twilio(options.accountSid, options.authToken);
	}

	/**
	 * Sends sms.
	 *
	 * @param recipient		Telephone number of the recipient.
	 * @param message		Message to be sent.
	 *
	 * @returns				Delivery status.
	 */
	public async send(recipient: string, message: string): Promise<string> {
		const delivery = await this.client.messages.create({ from: this.from, to: recipient, body: message });
		if (delivery.errorCode) {
			throw createException(ErrorCodes.SMS_DELIVERY_FAILED, `Code: ${delivery.errorCode}. Message: ${delivery.errorMessage}`, delivery);
		}
		return delivery.status;
	}
}

export { SmsClient, SmsClientOptions };
