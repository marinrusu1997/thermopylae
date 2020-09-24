import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	NOT_ALLOWED = 'NOT_ALLOWED',
	NOT_FOUND = 'NOT_FOUND',
	INVALID_TYPE = 'INVALID_TYPE',
	INVALID_QUERY = 'INVALID_QUERY',
	INVALID_UPDATE = 'INVALID_UPDATE',
	UNKNOWN = 'UNKNOWN',
	REDEFINITION = 'REDEFINITION',
	REQUIRED = 'REQUIRED'
}

function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(Library.COLLECTIONS, (code as unknown) as string, message, data);
}

export { createException, ErrorCodes };
