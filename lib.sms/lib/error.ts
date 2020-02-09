import { Exception } from '@marin/lib.error';
import { Libraries } from '@marin/lib.utils/dist/declarations';

const enum ErrorCodes {
	SMS_DELIVERY_FAILED = 'SMS_DELIVERY_FAILED'
}

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Libraries.SMS, code, message, data);
}

export { createException, ErrorCodes };
