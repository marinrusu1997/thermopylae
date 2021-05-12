import { Exception } from '@thermopylae/lib.exception';
import { CoreModule } from '@thermopylae/core.declarations';

/**
 * @private
 */
function createException(code: string, message: string): Exception {
	return new Exception(CoreModule.JWT_USER_SESSION, code, message);
}

export { createException };
