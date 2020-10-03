import { Exception } from '@thermopylae/lib.exception';
import { ErrorCodes, Library } from '@thermopylae/core.declarations';

/**
 * Create exception thrown by this library.
 *
 * @internal
 *
 * @param code		Error code.
 * @param message	Error message.
 *
 * @returns		Exception to be thrown.
 */
function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(Library.INDEXED_STORE, (code as unknown) as string, message);
}

export { createException, ErrorCodes };
