import { enums } from '@marin/lib.utils';
import { Exception } from '@marin/lib.error';

/**
 * Creates exception emitted by SMS system
 *
 * @param {string}	code	Error code
 * @param {string}	message	Error message
 * @param 			[data]	Error data
 *
 * @returns {Exception}
 */
function createException(code, message, data) {
	return new Exception(enums.SYSTEMS.SMS, code, message, data);
}

// eslint-disable-next-line import/prefer-default-export
export { createException };
