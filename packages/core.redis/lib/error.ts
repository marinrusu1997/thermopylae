import { Exception } from '@thermopylae/lib.exception';
import { Client, ErrorCodes } from '@thermopylae/core.declarations';

/**
 * @private
 */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(Client.REDIS, code, message, data);
}

export { createException };
