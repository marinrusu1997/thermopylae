import { ClientModule } from '@thermopylae/core.declarations';
import { LoggerManagerInstance, WinstonLogger } from '@thermopylae/core.logger';

/** @private */
let logger: WinstonLogger;

/**
 * Init internal logger used by the library. <br/> This method should be called once, at the
 * application start, before using library.
 */
function initLogger(): void {
	logger = LoggerManagerInstance.for(ClientModule.REDIS);
}

export { logger, initLogger };
