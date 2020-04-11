import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { Libraries } from '@marin/lib.utils/dist/declarations';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Libraries.AUTH_ENGINE);
	}
	return logger;
}

export { getLogger };
