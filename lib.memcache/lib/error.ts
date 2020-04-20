import { Exception } from '@thermopylae/lib.exception';
import { Libraries } from '@thermopylae/core.declarations';

const ErrorCodes = {
	DELETE_NOT_ALLOWED: 'DELETE_NOT_ALLOWED',
	CACHE_FULL: 'CACHE_FULL',
	INVALID_EXPIRES: 'INVALID_EXPIRES'
};

function createException(code: string, message: string, cause?: object): Exception {
	return new Exception(Libraries.MEM_CACHE, code, message, cause);
}

export { createException, ErrorCodes };
