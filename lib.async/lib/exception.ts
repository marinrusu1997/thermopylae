import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	UNABLE_TO_LOCK = 'UNABLE_TO_LOCK',
	TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
	INVALID_ARGUMENT = 'INVALID_ARGUMENT',
	INCONSISTENCY = 'INCONSISTENCY',
	FORCED_RELEASE = 'FORCED_RELEASE'
}

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(Library.UTILS, code, message, cause);
}

export { ErrorCodes, createException };
