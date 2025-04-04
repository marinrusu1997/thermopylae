import { CoreModule } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

const enum ErrorCodes {
	AUTHORIZATION_HEADER_NOT_FOUND = 'AUTHORIZATION_HEADER_NOT_FOUND',
	AUTHORIZATION_HEADER_INVALID_SCHEME = 'AUTHORIZATION_HEADER_INVALID_SCHEME',
	AUTHORIZATION_HEADER_HAS_NO_ACCESS_TOKEN = 'AUTHORIZATION_HEADER_HAS_NO_ACCESS_TOKEN',
	TOO_MANY_CONCURRENT_USER_SESSIONS = 'TOO_MANY_CONCURRENT_USER_SESSIONS',
	USER_SESSION_INSERTION_FAILED = 'USER_SESSION_INSERTION_FAILED'
}

/** @private */
function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(CoreModule.USER_SESSION_COMMONS, code, message);
}

export { createException, ErrorCodes };
