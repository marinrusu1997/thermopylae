import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	INVALID_ARGUMENT = 'INVALID_ARGUMENT',
	UNABLE_TO_LOCK = 'UNABLE_TO_LOCK',
	LOCK_NOT_FOUND = 'LOCK_NOT_FOUND',
	TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
	FORCED_RELEASE = 'FORCED_RELEASE',
	INCONSISTENCY = 'INCONSISTENCY'
}

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(Library.ASYNC, code, message, cause);
}

export { ErrorCodes, createException };
