import { Exception } from '@thermopylae/lib.exception';
import { Library } from '@thermopylae/core.declarations';

const enum ErrorCodes {
	MISCONFIGURATION = 'MISCONFIGURATION',

	CACHE_FULL = 'CACHE_FULL',
	KEY_NOT_FOUND = 'KEY_NOT_FOUND',
	LOCK_FAILURE = 'LOCK_FAILURE',

	INVALID_ARGUMENT = 'INVALID_ARGUMENT',
	INVALID_EXPIRATION = 'INVALID_EXPIRATION',
	INVALID_LAYER = 'INVALID_LAYER',
	INVALID_KEY_PART = 'INVALID_KEY_PART',

	ABNORMAL_CONDITION = 'ABNORMAL_CONDITION',
	FORBIDDEN = 'FORBIDDEN'
}

function createException(code: string, message: string, cause?: Record<string, unknown>): Exception {
	return new Exception(Library.CACHE, code, message, cause);
}

export { createException, ErrorCodes };
