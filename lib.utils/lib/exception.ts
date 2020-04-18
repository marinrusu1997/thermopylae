import { Exception } from '@thermopylae/lib.exception';
import { Libraries } from '@thermopylae/core.declarations';

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(Libraries.UTILS, code, message, cause);
}

export { createException };
