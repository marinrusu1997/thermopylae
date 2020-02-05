import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
// eslint-disable-next-line import/no-unresolved
import { Libraries } from '@marin/lib.utils/dist/declarations';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Libraries.GEO_IP);
	}
	return logger;
}

export { getLogger };
