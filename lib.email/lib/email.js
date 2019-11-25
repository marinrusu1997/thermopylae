import { createTransport } from 'nodemailer';
import { ErrorCodes, ErrorMessages } from '@marin/lib.utils';
import { createException } from './error';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     transport: Mailer
 * }}
 */
const internal = _this => {
	let data = storage.get(_this);
	if (!data) {
		data = {};
		storage.set(_this, data);
	}
	return data;
};

/** Class for email operations */
class Email {
	/**
	 * Inits the instance
	 *
	 * @param {TransportOptions}  options   	Transport options
	 * @param {object}            [defaults]  	Shared options for messages
	 *
	 * @throws {Exception}  When instance already initialized
	 */
	init(options, defaults) {
		let { transport } = internal(this);
		if (transport) {
			throw createException(ErrorCodes.ALREADY_INITIALIZED, ErrorMessages.ALREADY_INITIALIZED);
		}
		transport = createTransport(options, defaults);
	}

	/**
	 * Sends an email
	 *
	 * @param {EmailMessage}  message   Email message which needs to be sent
	 * @param {boolean}       [strict]  Flag which ensures that email was delivered to all recipients
	 *
	 * @throws {Exception}  When instance is not initialized
	 * @return {Promise<SendMailRecipe>}
	 */
	async send(message, strict) {
		const { transport } = internal(this);
		if (!transport) {
			throw createException(ErrorMessages.NOT_INITIALIZED, ErrorMessages.NOT_INITIALIZED);
		}
		const /** @type {SendMailRecipe} */ info = await transport.sendMail(message);
		if (strict && info.accepted.length !== message.to.length) {
			throw createException(ErrorMessages.NOT_DELIVERED, 'Email was not delivered to all recipients', info);
		}
		return info;
	}
}

export default Email;
export { Email };
