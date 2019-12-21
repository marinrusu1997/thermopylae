import { Exception } from '@marin/lib.error';
import { enums } from '@marin/lib.utils';

/**
 * Creates exception emitted by logging lib
 *
 * @param {string}	code
 * @param {string}	message
 * @param {*}		[data]
 *
 * @returns {Exception}
 */
function createException(code, message, data) {
	return new Exception(enums.SYSTEMS.LOGGING, code, message, data);
}

// eslint-disable-next-line import/prefer-default-export
export { createException };
