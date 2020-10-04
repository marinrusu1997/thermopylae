import { Clients } from '@marin/lib.utils/dist/declarations';
import LoggerInstance, { WinstonLogger } from '../../lib.logger.bk';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Clients.EMAIL);
	}
	return logger;
}

export { getLogger };
