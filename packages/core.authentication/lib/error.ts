import { Exception } from '@thermopylae/lib.exception';
import { CoreModule } from '@thermopylae/core.declarations';

/**
 * @private
 */
function createException(code: string, message: string): Exception {
	return new Exception(CoreModule.AUTHENTICATION, code, message);
}

export { createException };
