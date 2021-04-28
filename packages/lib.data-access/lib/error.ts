import { Exception } from '@thermopylae/lib.exception';
import { Client, ErrorCodes } from '@thermopylae/core.declarations';

/**
 * @private
 */
function createException(client: Client, code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(client, code, message, data);
}

export { createException };
