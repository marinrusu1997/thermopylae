import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	INVALID_REFRESH_TOKEN_LENGTH = 'INVALID_REFRESH_TOKEN_LENGTH',
	USER_SESSION_NOT_FOUND = 'USER_SESSION_NOT_FOUND',
	REFRESHING_ACCESS_TOKEN_FROM_DIFFERENT_CONTEXT_NOT_ALLOWED = 'REFRESHING_ACCESS_TOKEN_FROM_DIFFERENT_CONTEXT_NOT_ALLOWED',
	ACCESS_TOKEN_WAS_FORCIBLY_INVALIDATED = 'ACCESS_TOKEN_WAS_FORCIBLY_INVALIDATED',
	EXPIRES_IN_INVALID_TYPE = 'EXPIRES_IN_INVALID_TYPE'
}

/**
 * @private
 */
function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(Library.JWT_USER_SESSION, code, message);
}

export { createException, ErrorCodes };
