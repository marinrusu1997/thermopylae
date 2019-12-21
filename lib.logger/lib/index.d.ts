import { Logger, WinstonLogger } from "./logger/logger";

declare const LoggerInstance: Logger;

export default LoggerInstance;
export * from './log-context';
export { WinstonLogger };
