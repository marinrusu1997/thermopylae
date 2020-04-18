import { Exception } from '@thermopylae/lib.exception';
import { CoreModules } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	NO_OPTIONS = 'NO_OPTIONS',
	INVALID_JWT_ACCESS_TOKEN = 'INVALID_JWT_ACCESS_TOKEN'
}

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(CoreModules.JWT, code, message, cause);
}

export { ErrorCodes, createException };
