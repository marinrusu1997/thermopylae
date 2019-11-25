import { ConsoleTransportOptions } from 'winston/lib/winston/transports';
import * as Transport from 'winston-transport';
import { IAbstractLogsTransportManager } from "./abstractlogs-manager";

/** Stores console config and transport */
declare class ConsoleLogsManager implements IAbstractLogsTransportManager {
   /**
    * Console transport is intended for development purposes,
    * therefore no subsystems/service support is provided.
    *
    * Post-conditions:
    *    - does not create a default transport
    */
   constructor();

   /**
    * Creates console transport based on provided opts.
    * When no opts provided, will use `info` level.
    *
    * Post-conditions:
    *    - overwrites existing console transport
    *
    * @param  config  Winston console transport options
    * @api public
    */
   setConfig(config?: ConsoleTransportOptions): void;

   /**
    * @api private
    */
   get: (system: string) => Transport | null;
}

export default ConsoleLogsManager;
export { ConsoleLogsManager };
