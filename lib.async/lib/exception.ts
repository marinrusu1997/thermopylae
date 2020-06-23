import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	LOCK_NOT_FOUND = 'LOCK_NOT_FOUND',
	TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
	INVALID_PARAM = 'INVALID_PARAM',
	INCONSISTENCY = 'INCONSISTENCY',
	FORCED_RELEASE = 'FORCED_RELEASE'
}

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(Library.UTILS, code, message, cause);
}

export { ErrorCodes, createException };
