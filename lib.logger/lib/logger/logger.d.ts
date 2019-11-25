import { Logger as WinstonLogger } from 'winston';
import { FormattingManager } from "../formatting/formatting-manager";
import { ConsoleLogsManager } from "../transports/consolelogs-manager";
import { FileLogsManager } from "../transports/filelogs-manager";
import { GrayLogsManager } from "../transports/graylogs-manager";

/** Class responsible for providing loggers to app subsystems */
declare class Logger {
   /** Formatting manager which configures format of the logging output */
   formatting: FormattingManager;
   /** Console transport manager which configures console transport */
   console: ConsoleLogsManager;
   /** File transport manager which configures file transport */
   file: FileLogsManager;
   /** Graylog2 transport manager which configures graylog2 transport */
   graylog2: GrayLogsManager;

   /**
    * Constructs logger instance
    *
    * Post-conditions:
    *    - registers known transport logs managers to transport manager
    * */
   constructor();

   /**
    * Method used by subsystems to retrieve their loggers.
    * Internally will ask transports manager to give him transports needed to give transports.
    *
    * Pre-conditions:
    *    - system has to be registered to at least one underlying transports manager
    *    - system can't be logger, but @all subsystems has to be configured
    *
    * @param system
    * @throws {Error}   When a bad configuration is provided to underlying managers
    * @api public
    */
   for(system: string): WinstonLogger;
}

export default Logger;
export { Logger };
