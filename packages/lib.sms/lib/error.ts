import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	SMS_DELIVERY_FAILED = 'SMS_DELIVERY_FAILED'
}

/**
 * @internal
 */
function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Library.SMS_CLIENT, code, message, data);
}

export { createException, ErrorCodes };
