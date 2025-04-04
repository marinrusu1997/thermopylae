import { Library, type ObjMap } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

/**
 * Creates an `Exception` which is thrown by this library.
 *
 * @private
 *
 * @param   code    Error code.
 * @param   message Error message.
 * @param   cause   Addition data which reveals the context of exception.
 *
 * @returns         Exception instance.
 */
function createException(code: string, message: string, cause?: ObjMap): Exception {
	return new Exception(Library.UTILS, code, message, cause);
}

export { createException };
