import { Exception } from '@marin/lib.error';
import { enums } from '@marin/lib.utils';

function createException(code: string, message: string, data?: any): Exception {
	return new Exception(enums.SYSTEMS.EMAIL, code, message, data);
}

export { createException };
