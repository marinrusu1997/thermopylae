import { Exception } from '@marin/lib.error';
// eslint-disable-next-line import/no-unresolved
import { Libraries } from './declarations';

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(Libraries.UTILS, code, message, cause);
}

export { createException };
