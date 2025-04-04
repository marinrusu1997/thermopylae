import { CoreModule } from '@thermopylae/core.declarations';
import { LoggerManagerInstance, type WinstonLogger } from '@thermopylae/core.logger';

/** @private */
// oxlint-disable-next-line no-mutable-exports, init-declarations
let logger: WinstonLogger;

/**
 * Init internal logger used by the library. <br/> This method should be called once, at the
 * application start, before using library.
 */
function initLogger(): void {
	logger = LoggerManagerInstance.for(CoreModule.JWT_USER_SESSION);
}

export { logger, initLogger };
