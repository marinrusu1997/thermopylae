import { Libraries } from '@marin/lib.utils/dist/declarations';
import LoggerInstance, { WinstonLogger } from '../../lib.logger.bk';
// eslint-disable-next-line import/no-unresolved

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Libraries.GEO_IP);
	}
	return logger;
}

export { getLogger };
