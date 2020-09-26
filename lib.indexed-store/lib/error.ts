import { Exception } from '@thermopylae/lib.exception';
import { ErrorCodes, Library } from '@thermopylae/core.declarations';

function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(Library.INDEXED_STORE, (code as unknown) as string, message);
}

export { createException, ErrorCodes };
