import { IAbstractLogsTransportManager } from "./abstractlogs-manager";
import * as TransportStream from "winston-transport";

/**
 * Handles all types of transports
 * Used by loggers manager, aka package private class
 * */
declare class TransportsManager {
   /** Default constructible */
   constructor();

   /**
    * Registers transport managers, by adding them to list of known ones.
    *
    * Pre-conditions:
    *    - transport managers has not to be registered before
    *    - no mechanism for preventing duplicates exists
    *
    * @param transportManagers Instances which are implementing IAbstractLogsTransportManager
    */
   register(...transportManagers: Array<IAbstractLogsTransportManager>): void;

   /**
    * Given a system name, returns an array of transports.
    * Returned transports will contain combined transports from all managers on which this system was registered.
    *
    * Pre-conditions:
    *    - system has to be registered to at least one manager
    *    - system has to be registered under the same name to all managers
    *
    * @param system  Name of the system
    * @throws {Error}   When no transports configured for this system
    */
   for(system: string): Array<TransportStream>;
}

export { TransportsManager };
