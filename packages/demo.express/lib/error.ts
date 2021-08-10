import { Exception } from '@thermopylae/lib.exception';
import { SERVICE_NAME } from './app/constants';

const enum ErrorCodes {
	MISCONFIGURATION = 'MISCONFIGURATION',
	NOT_ALLOWED = 'NOT_ALLOWED',
	ALREADY_INITIALIZED = 'ALREADY_INITIALIZED',
	INVALID_CONFIG = 'INVALID_CONFIG'
}

/**
 * @private
 */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(SERVICE_NAME, code, message, data);
}

export { createException, ErrorCodes };
