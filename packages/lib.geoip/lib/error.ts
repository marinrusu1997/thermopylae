import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	REPOSITORY_NOT_FOUND = 'REPOSITORY_NOT_FOUND'
}

/**
 * @private
 */
function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(Library.GEO_IP, code, message);
}

export { createException, ErrorCodes };
