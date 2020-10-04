import LoggerInstance, { WinstonLogger } from '../../lib.logger.bk';
import { Libraries } from '@marin/lib.utils/dist/declarations';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Libraries.AUTH_ENGINE);
	}
	return logger;
}

export { getLogger };
