import Logger from '@marin/lib.logger';
import { WinstonLogger } from '@marin/lib.logger/lib';
import { enums } from '@marin/lib.utils';

let logger: WinstonLogger | undefined;
function getLogger(): WinstonLogger {
	if (!logger) {
		logger = Logger.for(enums.SYSTEMS.EMAIL);
	}
	return logger;
}

export { getLogger };
