import { Exception } from '@thermopylae/lib.exception';
import { Library, ErrorCodes } from '@thermopylae/core.declarations';

function createException(code: ErrorCodes, message: string, cause?: Record<string, unknown>): Exception {
	return new Exception(Library.CACHE, code, message, cause);
}

export { createException, ErrorCodes };
