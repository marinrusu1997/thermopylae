import * as TransportStream from "winston-transport";
import { DailyRotateFileTransportOptions } from 'winston-daily-rotate-file';
import { IAbstractLogsTransportManager } from "./abstractlogs-manager";

/** Class responsible for holding file transport options and file transport object */
declare class FileLogsManager implements IAbstractLogsTransportManager {
   /**
    * The same file will be used for logging.
    *
    * Post-conditions:
    *    - does not construct a default transport
    */
   constructor();

   /**
    * Config used by manager to create file transport instance.
    *
    * @param   config   Template config
    * @api public
    */
   setConfig(config: DailyRotateFileTransportOptions): void;

   /**
    * System param is silently discarded. All systems will log to same file
    * with the level specified in file transport config.
    * When config is not set, it means file transport is not used.
    *
    * @api private
    */
   get: (system: string) => TransportStream | null;
}

export default FileLogsManager;
export { FileLogsManager };
