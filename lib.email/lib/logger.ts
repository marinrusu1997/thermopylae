import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { Libraries } from '@marin/lib.utils/dist/enums';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Libraries.EMAIL);
	}
	return logger;
}

export { getLogger };
