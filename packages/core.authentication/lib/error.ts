import { Exception } from '@thermopylae/lib.exception';
import { CoreModule } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
	ACTIVATE_ACCOUNT_SESSION_NOT_CREATED = 'ACTIVATE_ACCOUNT_SESSION_NOT_CREATED',
	AUTHENTICATION_SESSION_NOT_CREATED = 'AUTHENTICATION_SESSION_NOT_CREATED',
	FAILED_AUTHENTICATION_ATTEMPTS_SESSION_NOT_CREATED = 'FAILED_AUTHENTICATION_ATTEMPTS_SESSION_NOT_CREATED',
	FORGOT_PASSWORD_SESSION_NOT_CREATED = 'FORGOT_PASSWORD_SESSION_NOT_CREATED'
}

/**
 * @private
 */
function createException(code: string, message: string): Exception {
	return new Exception(CoreModule.AUTHENTICATION, code, message);
}

export { createException, ErrorCodes };
