import { Exception } from '@marin/lib.error';
import { SYSTEMS } from './enums';

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(SYSTEMS.UTILS, code, message, cause);
}

export { createException };
