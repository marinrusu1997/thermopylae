import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { Services } from '@marin/declarations/services';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Services.AUTH);
	}
	return logger;
}

export { getLogger };
