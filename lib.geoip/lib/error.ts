import { Exception } from '@marin/lib.error';
import { enums, errors } from '@marin/lib.utils';

const { ErrorCodes } = errors;

function createException(code: string, message: string): Exception {
	return new Exception(enums.SYSTEMS.GEO_IP, code, message);
}

export { createException, ErrorCodes };
