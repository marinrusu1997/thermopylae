import { Logger } from './logger';

const LoggerInstance = new Logger();
Object.freeze(LoggerInstance);

export { LoggerInstance };

export { DefaultFormatters, OutputFormat } from './formatting-manager';
export { ConsoleTransportOptions } from './transports/console';
export { DailyRotateFileTransportOptions } from './transports/file';
export { GraylogLoggingChannel, GraylogEndpoint } from './transports/graylog';