import { Exception } from '@marin/lib.error';

const ErrorCodes = {
	INVALID_CONTEXT_TOKEN: 'INVALID_CONTEXT_TOKEN',
	NOT_INITIALIZED: 'NOT_INITIALIZED'
};

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
	// fixme turn this module into TS one and make use of const enums
	return new Exception('LOGGER_LIB', code, message, data);
}

// eslint-disable-next-line import/prefer-default-export
export { createException, ErrorCodes };
