import LoggerInstance, { WinstonLogger } from '@marin/lib.logger';
import { enums } from '@marin/lib.utils';

const logger: WinstonLogger = LoggerInstance.for(enums.SERVICES.AUTH);

export { logger };
