import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { enums } from '@marin/lib.utils';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(enums.SERVICES.AUTH);
	}
	return logger;
}

export { getLogger };
