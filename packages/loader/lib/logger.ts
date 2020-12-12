import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { Modules } from '@marin/declarations/lib/modules';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Modules.LOADER);
	}
	return logger;
}

export { getLogger };
