import { Library } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

const enum ErrorCodes {
	DOCUMENT_NOT_VALID_AGAINST_JSON_SCHEMA = 'DOCUMENT_NOT_VALID_AGAINST_JSON_SCHEMA',
	SORTING_FIELD_REQUIRED = 'SORTING_FIELD_REQUIRED',
	UNKNOWN_PROJECTION_TYPE = 'UNKNOWN_PROJECTION_TYPE',
	OPERATOR_NOT_SUPPORTED = 'OPERATOR_NOT_SUPPORTED'
}

/** @private */
function createException(code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(Library.COLLECTION, code as unknown as string, message, data);
}

export { createException, ErrorCodes };
