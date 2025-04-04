import { ClientModule } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

enum ErrorCodes {
	SMS_DELIVERY_FAILED = 'SMS_DELIVERY_FAILED'
}

/** @private */
function createException(code: string, message: string, data?: unknown): Exception {
	return new Exception(ClientModule.SMS, code, message, data);
}

export { createException, ErrorCodes };
