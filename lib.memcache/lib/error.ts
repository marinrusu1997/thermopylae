import { Exception } from '@thermopylae/lib.exception';
import { Libraries } from '@thermopylae/core.declarations';

const ErrorCodes = {
	OPERATION_NOT_SUPPORTED: 'OPERATION_NOT_SUPPORTED',
	CACHE_FULL: 'CACHE_FULL',
	INVALID_EXPIRATION: 'INVALID_EXPIRATION'
};

function createException(code: string, message: string, cause?: object): Exception {
	return new Exception(Libraries.MEM_CACHE, code, message, cause);
}

export { createException, ErrorCodes };
