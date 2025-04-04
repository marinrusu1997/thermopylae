import { LoggerManager, WinstonLogger } from './logger-manager.js';

const LoggerManagerInstance = new LoggerManager();
Object.freeze(LoggerManagerInstance);

export { LoggerManagerInstance, LoggerManager, WinstonLogger };

export { DefaultFormatters, OutputFormat } from './formatting-manager.js';
export type { ConsoleTransportOptions } from './transports/console.js';
export type { DailyRotateFileTransportOptions } from './transports/file.js';
export type { GraylogLoggingChannel, GraylogEndpoint } from './transports/graylog.js';
