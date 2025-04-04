import { ClientModule } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

const enum ErrorCodes {
	REGULAR_CONNECTION_CONFIG_REQUIRED = 'REGULAR_CONNECTION_CONFIG_REQUIRED'
}

/** @private */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(ClientModule.REDIS, code, message, data);
}

export { createException, ErrorCodes };
