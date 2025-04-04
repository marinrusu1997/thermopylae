import { Library } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

const enum ErrorCodes {
	LIMIT_REACHED = 'LIMIT_REACHED',
	INVALID_PARAM = 'INVALID_PARAM'
}

/** @private */
function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(Library.POOL, code, message, cause);
}

export { ErrorCodes, createException };
