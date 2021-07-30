import { LoggerManager, WinstonLogger } from './logger-manager';

const LoggerManagerInstance = new LoggerManager();
Object.freeze(LoggerManagerInstance);

export { LoggerManagerInstance, LoggerManager, WinstonLogger };

export { DefaultFormatters, OutputFormat } from './formatting-manager';
export { ConsoleTransportOptions } from './transports/console';
export { DailyRotateFileTransportOptions } from './transports/file';
export { GraylogLoggingChannel, GraylogEndpoint } from './transports/graylog';
