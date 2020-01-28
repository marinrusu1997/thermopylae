import { Exception } from '@marin/lib.error';
import { Libraries } from '@marin/lib.utils/dist/enums';

const enum ErrorCodes {
	REST_API_ROUTER_ALREADY_INITIALIZED = 'REST_API_ROUTER_ALREADY_INITIALIZED',
	REST_API_ROUTER_NOT_INITIALIZED = 'REST_API_ROUTER_NOT_INITIALIZED',
	MISCONFIGURATION_METHOD_CONTROLLER_NOT_FOUND = 'MISCONFIGURATION_METHOD_CONTROLLER_NOT_FOUND',
	MISCONFIGURATION_SERVICE_CONTROLLER_NOT_FOUND = 'MISCONFIGURATION_SERVICE_CONTROLLER_NOT_FOUND'
}

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Libraries.REST_API, code, message, data);
}

export { ErrorCodes, createException };
