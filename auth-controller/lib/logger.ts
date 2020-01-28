import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
// eslint-disable-next-line import/no-extraneous-dependencies, import/no-unresolved
import { Services } from '@marin/lib.utils/dist/enums';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Services.AUTH);
	}
	return logger;
}

export { getLogger };
