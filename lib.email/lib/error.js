import { Exception } from '@marin/lib.error';

/**
 * Creates an Exception emitted by Email Utils
 *
 * @param {string}  code    Error Code
 * @param {string}  message Error Message
 * @param           [data]  Error Data
 *
 * @returns {Exception}
 */
function createException(code, message, data) {
	return new Exception('email utils', code, message, data);
}

export default createException;
export { createException };
