import { Exception } from '@marin/lib.error';
import { Services } from '@marin/declarations/lib/services';

const enum ErrorCodes {
	MISCONFIGURATION = 'MISCONFIGURATION',
	MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED = 'MISCONFIGURATION_STATUS_CODE_COULD_NOT_BE_DETERMINED',
	MISCONFIGURATION_JWT_TTL_FOR_ACCOUNT_NOT_FOUND_BY_AUTH_ENGINE = 'MISCONFIGURATION_JWT_TTL_FOR_ACCOUNT_NOT_FOUND_BY_AUTH_ENGINE',
	INVALID_LOGOUT_TYPE = 'INVALID_LOGOUT_TYPE'
}

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Services.AUTH, code, message, data);
}

export { ErrorCodes, createException };
