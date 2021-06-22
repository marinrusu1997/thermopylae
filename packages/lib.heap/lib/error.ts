import { Exception } from '@thermopylae/lib.exception';
import { Library, ErrorCodes } from '@thermopylae/core.declarations';

function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(Library.HEAP, code, message);
}

export { createException, ErrorCodes };
