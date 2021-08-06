import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	INVALID_CACHE_MAX_CAPACITY = 'INVALID_CACHE_MAX_CAPACITY',
	INVALID_PROTECTED_SEGMENT_SIZE = 'INVALID_PROTECTED_SEGMENT_SIZE',
	INVALID_PROBATION_SEGMENT_SIZE = 'INVALID_PROBATION_SEGMENT_SIZE',
	INVALID_EXPIRES_AFTER = 'INVALID_EXPIRES_AFTER',
	INVALID_EXPIRES_FROM = 'INVALID_EXPIRES_FROM',
	UNKNOWN_SEGMENT_TYPE = 'UNKNOWN_SEGMENT_TYPE',
	DEPENDENCY_KEY_NOT_FOUND = 'DEPENDENCY_KEY_NOT_FOUND',
	DEPENDENT_KEY_NOT_FOUND = 'DEPENDENT_KEY_NOT_FOUND'
}

/**
 * @private
 */
function createException(code: ErrorCodes, message: string, cause?: Record<string, unknown>): Exception {
	return new Exception(Library.CACHE, code, message, cause);
}

export { createException, ErrorCodes };
