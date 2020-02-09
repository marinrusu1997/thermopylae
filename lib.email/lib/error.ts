import { Exception } from '@marin/lib.error';
import { Libraries } from '@marin/lib.utils/dist/declarations';

const enum ErrorCodes {
	EMAIL_DELIVERY_FAILED = 'EMAIL_DELIVERY_FAILED'
}

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Libraries.EMAIL, code, message, data);
}

export { createException, ErrorCodes };
