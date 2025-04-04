import { ClientModule } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

const enum ErrorCodes {
	MISCONFIGURATION = 'MISCONFIGURATION',
	UNKNOWN_CONNECTION_TYPE = 'UNKNOWN_CONNECTION_TYPE'
}

/** @private */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(ClientModule.MYSQL, code, message, data);
}

export { createException, ErrorCodes };
