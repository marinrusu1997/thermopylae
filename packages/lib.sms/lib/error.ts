import { Exception } from '@thermopylae/lib.exception';
import { ClientModule } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	SMS_DELIVERY_FAILED = 'SMS_DELIVERY_FAILED'
}

/**
 * @private
 */
function createException(code: string, message: string, data?: any): Exception {
	return new Exception(ClientModule.SMS, code, message, data);
}

export { createException, ErrorCodes };
