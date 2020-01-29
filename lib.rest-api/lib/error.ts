import { Exception } from '@marin/lib.error';
import { Libraries } from '@marin/lib.utils/dist/enums';

const enum ErrorCodes {
	MISCONFIGURATION_METHOD_REQUEST_HANDLERS_NOT_FOUND = 'MISCONFIGURATION_METHOD_REQUEST_HANDLERS_NOT_FOUND',
	MISCONFIGURATION_SERVICE_REQUEST_HANDLERS_NOT_FOUND = 'MISCONFIGURATION_SERVICE_REQUEST_HANDLERS_NOT_FOUND'
}

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Libraries.REST_API, code, message, data);
}

export { ErrorCodes, createException };
