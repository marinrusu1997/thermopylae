import { Exception } from '@marin/lib.error';
import { ErrorCodes, ErrorMessages, SERVICES } from '@marin/lib.utils';

/**
 * Creates exception which is thrown by Auth Service
 *
 * @param {string}  code    Error Code
 * @param {string}  message Error Message
 * @param           [data]  Exception additional data
 *
 * @returns {Exception}
 */
function createException(code, message, data) {
	return new Exception(SERVICES.AUTH, code, message, data);
}

export { ErrorCodes, ErrorMessages, createException };
