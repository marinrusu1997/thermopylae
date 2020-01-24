import { Exception } from '@marin/lib.error';
import { Libraries } from '@marin/lib.utils/dist/enums';

const ErrorCodes = {
	ITEM_TRACKING_FAILED: 'ITEM_TRACKING_FAILED'
};

const ErrorMessages = {
	ITEM_TRACKING_FAILED: 'Failed to track item with key '
};

function createException(code: string, message: string, cause?: object): Exception {
	return new Exception(Libraries.MEM_CACHE, code, message, cause);
}

export { createException, ErrorCodes, ErrorMessages };
