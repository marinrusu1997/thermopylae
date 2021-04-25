import { Client } from '@thermopylae/core.declarations';
import { LoggerInstance, WinstonLogger } from '@thermopylae/lib.logger';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Client.EMAIL);
	}
	return logger;
}

export { getLogger };
