import { LoggerInstance, WinstonLogger } from '@thermopylae/core.logger';
import { Library } from '@thermopylae/core.declarations';

/**
 * @private
 */
// eslint-disable-next-line import/no-mutable-exports
let logger: WinstonLogger;

/**
 * Init internal logger used by the library. <br/>
 * This method should be called once, at the application start, before using library.
 */
function initLogger(): void {
	logger = LoggerInstance.for(Library.UNIT_TEST);
}

export { logger, initLogger };