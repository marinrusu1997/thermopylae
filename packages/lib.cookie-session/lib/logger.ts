import { LoggerInstance, WinstonLogger } from '@thermopylae/lib.logger';
import { Library } from '@thermopylae/core.declarations';

/**
 * @private
 */
// eslint-disable-next-line import/no-mutable-exports
let logger: WinstonLogger;

/**
 * Init internal logger used by the library. <br/>
 * This method should be called once, at the application start, before using {@link CookieSessionManager}.
 */
function initLogger(): void {
	logger = LoggerInstance.for(Library.COOKIE_SESSION);
}

export { logger, initLogger };