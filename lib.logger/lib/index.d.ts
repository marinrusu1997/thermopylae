import { Logger, WinstonLogger } from "./logger/logger";
import { FormattingManager } from './formatting/formatting-manager';
import { GrayLogsManager } from './transports/graylogs-manager';

declare const LoggerInstance: Logger;

export default LoggerInstance;
export * from './log-context';
export { WinstonLogger, FormattingManager, GrayLogsManager };
