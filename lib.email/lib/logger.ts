import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { Clients } from '@marin/lib.utils/dist/declarations';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Clients.EMAIL);
	}
	return logger;
}

export { getLogger };
