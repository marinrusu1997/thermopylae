import { Exception } from '@marin/lib.error';
import { errors, enums } from '@marin/lib.utils';

const ErrorCodes = {
	...errors.ErrorCodes,
	ACCOUNT_WAS_LOCKED: 'ACCOUNT_WAS_LOCKED'
};
const { ErrorMessages } = errors;

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(enums.SERVICES.AUTH, code, message, data);
}

export { ErrorCodes, ErrorMessages, createException };
