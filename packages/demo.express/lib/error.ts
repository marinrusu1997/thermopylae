import { Exception } from '@thermopylae/lib.exception';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { SERVICE_NAME } from './constants';

/**
 * @private
 */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(SERVICE_NAME, code, message, data);
}

export { createException };
