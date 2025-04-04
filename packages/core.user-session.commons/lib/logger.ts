import { CoreModule } from '@thermopylae/core.declarations';
import { LoggerManagerInstance } from '@thermopylae/core.logger';
import type { WinstonLogger } from '@thermopylae/core.logger';

/** @private */
let logger: WinstonLogger;

/**
 * Init internal logger used by the library. <br/> This method should be called once, at the
 * application start, before using library.
 */
function initLogger(): void {
	logger = LoggerManagerInstance.for(CoreModule.USER_SESSION_COMMONS);
}

export { logger, initLogger };
