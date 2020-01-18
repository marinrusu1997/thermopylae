import { Exception } from '@marin/lib.error';
import { errors, services } from '@marin/lib.utils';

const ErrorCodes = {
	...errors.ErrorCodes,
	ACCOUNT_IS_LOCKED: 'ACCOUNT_IS_LOCKED',
	INVALID_PASSWORD: 'INVALID_PASSWORD',
	WEAK_PASSWORD: 'WEAK_PASSWORD'
};
const { ErrorMessages } = errors;

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(services.SERVICES.AUTH, code, message, data);
}

export { ErrorCodes, ErrorMessages, createException };
