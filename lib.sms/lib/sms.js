import twilio from 'twilio';
import { ErrorCodes } from '@marin/lib.utils';
import { createException } from './error';

const storage = new WeakMap();
/**
 * Private class data
 *
 * @param {Object} _this This of the class
 * @return {{
 *     from: string,
 *     client: Twilio
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

class SMS {
	/** @param {IOptions} opts */
	init(opts) {
		const privateThis = internal(this);
		if (privateThis.client) {
			throw createException(ErrorCodes.ALREADY_INITIALIZED, 'SMS system already intialized');
		}
		privateThis.from = opts.fromNumber;
		privateThis.client = twilio(opts.accountSid, opts.authToken);
	}

	async send(to, body) {
		const { client, from } = internal(this);
		if (!client) {
			throw createException(ErrorCodes.NOT_INITIALIZED, 'SMS system is not intialized');
		}
		const /** @type {MessageInstance} */ message = await client.messages.create({ from, to, body });
		if (message.errorCode) {
			throw createException(ErrorCodes.NOT_DELIVERED, message.errorMessage, message);
		}
		return message.sid;
	}
}

export default SMS;
export { SMS };
