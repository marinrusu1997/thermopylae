import { Exception } from '@marin/lib.error';
// eslint-disable-next-line import/no-unresolved
import { Libraries } from '@marin/lib.utils/dist/declarations';

const enum ErrorCodes {
	IP_LOCATION_NOT_FOUND = 'IP_LOCATION_NOT_FOUND'
}

function createException(code: string, message: string): Exception {
	return new Exception(Libraries.GEO_IP, code, message);
}

export { createException, ErrorCodes };
