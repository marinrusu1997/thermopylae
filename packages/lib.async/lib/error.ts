import { Library } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

enum ErrorCodes {
	INVALID_ARGUMENT = 'INVALID_ARGUMENT',
	UNABLE_TO_LOCK = 'UNABLE_TO_LOCK',
	LOCK_NOT_FOUND = 'LOCK_NOT_FOUND',
	TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
	FORCED_RELEASE = 'FORCED_RELEASE',
	INCONSISTENCY = 'INCONSISTENCY'
}

/** @private */
function createException(code: string, message: string, cause?: unknown): Exception {
	return new Exception(Library.ASYNC, code, message, cause);
}

export { ErrorCodes, createException };
