import { Services } from '@marin/declarations/lib/services';
import LoggerInstance, { WinstonLogger } from '../../lib.logger.bk';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Services.AUTH);
	}
	return logger;
}

export { getLogger };
