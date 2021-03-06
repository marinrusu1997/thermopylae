import { Exception } from '@thermopylae/lib.exception';
import { CoreModule } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	REFRESH_TOKEN_NOT_FOUND_IN_THE_REQUEST = 'REFRESH_TOKEN_NOT_FOUND_IN_THE_REQUEST',
	CSRF_HEADER_INVALID_VALUE = 'CSRF_HEADER_INVALID_VALUE',
	SIGNATURE_COOKIE_NAME_NOT_IN_LOWER_CASE = 'SIGNATURE_COOKIE_NAME_NOT_IN_LOWER_CASE',
	PAYLOAD_COOKIE_NAME_NOT_IN_LOWER_CASE = 'PAYLOAD_COOKIE_NAME_NOT_IN_LOWER_CASE',
	REFRESH_COOKIE_NAME_NOT_IN_LOWER_CASE = 'REFRESH_COOKIE_NAME_NOT_IN_LOWER_CASE',
	ACCESS_TOKEN_HEADER_NAME_NOT_IN_LOWER_CASE = 'ACCESS_TOKEN_HEADER_NAME_NOT_IN_LOWER_CASE',
	REFRESH_TOKEN_HEADER_NAME_NOT_IN_LOWER_CASE = 'REFRESH_TOKEN_HEADER_NAME_NOT_IN_LOWER_CASE',
	CSRF_TOKEN_HEADER_NAME_NOT_IN_LOWER_CASE = 'CSRF_TOKEN_HEADER_NAME_NOT_IN_LOWER_CASE'
}

/**
 * @private
 */
function createException(code: string, message: string): Exception {
	return new Exception(CoreModule.JWT_USER_SESSION, code, message);
}

export { createException, ErrorCodes };
