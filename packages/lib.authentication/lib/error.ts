import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	ACCOUNT_ALREADY_REGISTERED = 'ACCOUNT_ALREADY_REGISTERED',
	ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
	ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',

	TWO_FACTOR_AUTH_TOKEN_NOT_PROVIDED = 'TWO_FACTOR_AUTH_TOKEN_NOT_PROVIDED',

	INCORRECT_CREDENTIALS = 'INCORRECT_CREDENTIALS',
	INCORRECT_PASSWORD = 'INCORRECT_PASSWORD',

	SAME_PASSWORD = 'SAME_PASSWORD',
	WEAK_PASSWORD = 'WEAK_PASSWORD',

	RECAPTCHA_THRESHOLD_REACHED = 'RECAPTCHA_THRESHOLD_REACHED',

	SESSION_NOT_FOUND = 'SESSION_NOT_FOUND'
}

/**
 * @private
 */
function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Library.AUTHENTICATION, code, message, data);
}

export { ErrorCodes, createException };
