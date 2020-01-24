import { Exception } from '@marin/lib.error';
import { Libraries } from '@marin/lib.utils/dist/enums';

const enum ErrorCodes {
	SMS_CLIENT_NOT_INITIALIZED = 'SMS_CLIENT_NOT_INITIALIZED',
	SMS_CLIENT_ALREADY_INITIALIZED = 'SMS_CLIENT_ALREADY_INITIALIZED',
	SMS_DELIVERY_FAILED = 'SMS_DELIVERY_FAILED'
}

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Libraries.SMS, code, message, data);
}

export { createException, ErrorCodes };
