import { LoggerManagerInstance } from '@thermopylae/core.logger';
import type { WinstonLogger } from '@thermopylae/core.logger';
import { SERVICE_NAME } from './app/constants';

/**
 * @private
 */
// eslint-disable-next-line import/no-mutable-exports
let logger: WinstonLogger;

/**
 * @private
 */
// eslint-disable-next-line import/no-mutable-exports
let kafkaLogger: WinstonLogger;

function initLogger(): void {
	logger = LoggerManagerInstance.for(SERVICE_NAME);
}

function initKafkaLogger(): void {
	kafkaLogger = LoggerManagerInstance.for('KAFKA_CLIENT');
}

export { logger, kafkaLogger, initLogger, initKafkaLogger };
