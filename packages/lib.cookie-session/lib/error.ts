import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

/**
 * @private
 */
function createException(code: string, message: string): Exception {
	return new Exception(Library.COOKIE_SESSION, code, message);
}

export { createException };