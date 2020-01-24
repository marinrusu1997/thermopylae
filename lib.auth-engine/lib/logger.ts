import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { Libraries } from '@marin/lib.utils/dist/enums';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = LoggerInstance.for(Libraries.AUTH_ENGINE);
	}
	return logger;
}

export { getLogger };
