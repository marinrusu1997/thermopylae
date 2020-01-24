import { Exception } from '@marin/lib.error';
import { Services } from '@marin/lib.utils/dist/enums';

const enum ErrorCodes {
	MISCONFIGURATION = 'MISCONFIGURATION'
}

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(Services.AUTH, code, message, data);
}

export { ErrorCodes, createException };
