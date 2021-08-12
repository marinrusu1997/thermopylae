import { LoggerManagerInstance } from '@thermopylae/core.logger';
import type { WinstonLogger } from '@thermopylae/core.logger';
import { ApplicationServices } from './constants';

// eslint-disable-next-line import/no-mutable-exports
let logger: WinstonLogger;

// eslint-disable-next-line import/no-mutable-exports
let kafkaLogger: WinstonLogger;

function initLoggers(): void {
	logger = LoggerManagerInstance.for(ApplicationServices.AUTHENTICATION);
	kafkaLogger = LoggerManagerInstance.for(ApplicationServices.KAFKA);
}

export { logger, kafkaLogger, initLoggers };
