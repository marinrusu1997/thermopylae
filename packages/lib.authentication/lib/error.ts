import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
	ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
	ACCOUNT_WITH_DUPLICATED_FIELDS = 'ACCOUNT_WITH_DUPLICATED_FIELDS',

	INCORRECT_CREDENTIALS = 'INCORRECT_CREDENTIALS',
	INCORRECT_PASSWORD = 'INCORRECT_PASSWORD',

	NO_TELEPHONE_NUMBER = 'NO_TELEPHONE_NUMBER',

	SIMILAR_PASSWORDS = 'SIMILAR_PASSWORDS',
	WEAK_PASSWORD = 'WEAK_PASSWORD',

	INCORRECT_RECAPTCHA = 'INCORRECT_RECAPTCHA',

	SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',

	TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY = 'TWO_FACTOR_AUTH_TOKEN_ISSUED_ALREADY'
}

/**
 * @private
 */
function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Library.AUTHENTICATION, code, message, data);
}

export { ErrorCodes, createException };
