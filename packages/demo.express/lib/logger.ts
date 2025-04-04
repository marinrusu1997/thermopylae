// oxlint-disable no-mutable-exports, init-declarations
import { LoggerManagerInstance, type WinstonLogger } from '@thermopylae/core.logger';
import { ApplicationServices } from './constants.js';

let logger: WinstonLogger;

let kafkaLogger: WinstonLogger;

function initLoggers(): void {
	logger = LoggerManagerInstance.for(ApplicationServices.AUTHENTICATION);
	kafkaLogger = LoggerManagerInstance.for(ApplicationServices.KAFKA);
}

export { logger, kafkaLogger, initLoggers };
