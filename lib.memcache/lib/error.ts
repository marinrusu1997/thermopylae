import { Exception } from '@thermopylae/lib.exception';
import { Libraries } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	OPERATION_NOT_SUPPORTED = 'OPERATION_NOT_SUPPORTED',
	CACHE_FULL = 'CACHE_FULL',
	INVALID_EXPIRATION = 'INVALID_EXPIRATION',
	KEY_NOT_FOUND = 'KEY_NOT_FOUND',
	ABNORMAL_CONDITION = 'ABNORMAL_CONDITION'
}

function createException(code: string, message: string, cause?: object): Exception {
	return new Exception(Libraries.MEM_CACHE, code, message, cause);
}

export { createException, ErrorCodes };
