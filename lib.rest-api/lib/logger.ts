import { Libraries } from '@marin/lib.utils/dist/declarations';
import LoggerInstance, { WinstonLogger } from '../../lib.logger.bk';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Libraries.REST_API);
	}
	return logger;
}

export { getLogger };
