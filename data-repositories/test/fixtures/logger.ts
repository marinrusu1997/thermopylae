import LoggerInstance, { FormattingManager, WinstonLogger } from '@marin/lib.logger';

const LOG_LEVEL = process.env.ENV_LOG_LEVEL || 'debug';
const LOGGER_NAME = process.env.ENV_LOGGER_NAME || 'TEST_ENV';

LoggerInstance.console.setConfig({ level: LOG_LEVEL });
LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);
const Logger: WinstonLogger = LoggerInstance.for(LOGGER_NAME);

export { Logger };
