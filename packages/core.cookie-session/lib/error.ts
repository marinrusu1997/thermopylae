import { Exception } from '@thermopylae/lib.exception';
import { CoreModule } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	CSRF_HEADER_INVALID_VALUE = 'CSRF_HEADER_INVALID_VALUE',
	SESSION_COOKIE_NAME_INVALID_FORMAT = 'SESSION_COOKIE_NAME_INVALID_FORMAT',
	SESSION_COOKIE_NAME_MUST_BE_LOWERCASE = 'SESSION_COOKIE_NAME_MUST_BE_LOWERCASE',
	SESSION_ID_HEADER_NAME_MUST_BE_LOWERCASE = 'SESSION_ID_HEADER_NAME_MUST_BE_LOWERCASE',
	CSRF_HEADER_NAME_MUST_BE_LOWERCASE = 'CSRF_HEADER_NAME_MUST_BE_LOWERCASE'
}

/**
 * @private
 */
function createException(code: string, message: string): Exception {
	return new Exception(CoreModule.COOKIE_USER_SESSION, code, message);
}

export { createException, ErrorCodes };
