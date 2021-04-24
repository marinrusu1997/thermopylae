import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

function createException(code: string, message: string, cause?: any): Exception {
	return new Exception(Library.JWT_SESSION, code, message, cause);
}

export { createException };
