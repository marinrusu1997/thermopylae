import { Library } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

enum ErrorCodes {
	LIMIT_REACHED = 'LIMIT_REACHED',
	INVALID_PARAM = 'INVALID_PARAM'
}

/** @private */
function createException(code: string, message: string, cause?: unknown): Exception {
	return new Exception(Library.POOL, code, message, cause);
}

export { ErrorCodes, createException };
