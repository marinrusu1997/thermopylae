import { Exception } from '@thermopylae/lib.exception';
import { Library, ErrorCodes } from '@thermopylae/core.declarations';

/**
 * @internal
 */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(Library.COLLECTION, (code as unknown) as string, message, data);
}

export { createException, ErrorCodes };
