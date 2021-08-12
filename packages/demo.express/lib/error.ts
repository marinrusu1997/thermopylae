import { Exception } from '@thermopylae/lib.exception';
import { ApplicationServices } from './constants';

const enum ErrorCodes {
	MISCONFIGURATION = 'MISCONFIGURATION',
	NOT_ALLOWED = 'NOT_ALLOWED',
	ALREADY_INITIALIZED = 'ALREADY_INITIALIZED',
	INVALID_CONFIG = 'INVALID_CONFIG',
	UNKNOWN = 'UNKNOWN'
}

/**
 * @private
 */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(ApplicationServices.AUTHENTICATION, code, message, data);
}

export { createException, ErrorCodes };
