import { Library } from '@thermopylae/core.declarations';
import { Exception } from '@thermopylae/lib.exception';

const enum ErrorCodes {
	RECORD_EXISTS = 'RECORD_EXISTS',
	RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
	INDEX_EXISTS = 'INDEX_EXISTS',
	INDEX_NOT_FOUND = 'INDEX_NOT_FOUND',
	PREDICATE_REQUIRED = 'PREDICATE_REQUIRED',
	REINDEX_OF_PRIMARY_KEY_NOT_ALLOWED = 'REINDEX_OF_PRIMARY_KEY_NOT_ALLOWED',
	REINDEXING_SAME_VALUE = 'REINDEXING_SAME_VALUE',
	PRIMARY_KEY_VALUE_REQUIRED = 'PRIMARY_KEY_VALUE_REQUIRED',
	DROPPING_OF_PRIMARY_INDEX_NOT_ALLOWED = 'DROPPING_OF_PRIMARY_INDEX_NOT_ALLOWED',
	NULLABLE_PRIMARY_KEY_CANNOT_BE_INDEXED = 'NULLABLE_PRIMARY_KEY_CANNOT_BE_INDEXED',
	INDEX_PROPERTY_INVALID_TYPE = 'INDEX_PROPERTY_INVALID_TYPE',
	NULLABLE_INDEX_VALUE_NOT_ALLOWED = 'NULLABLE_INDEX_VALUE_NOT_ALLOWED'
}

/**
 * Create exception thrown by this library.
 *
 * @private
 *
 * @param   code    Error code.
 * @param   message Error message.
 *
 * @returns         Exception to be thrown.
 */
function createException(code: ErrorCodes, message: string): Exception {
	return new Exception(Library.INDEXED_STORE, code, message);
}

export { createException, ErrorCodes };
