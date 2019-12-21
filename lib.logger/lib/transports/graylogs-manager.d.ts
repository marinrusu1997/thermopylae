import { IAbstractLogsTransportManager } from "./abstractlogs-manager";
import * as TransportStream from "winston-transport";

/** Class responsible for holding references to graylog inputs */
declare class GrayLogsManager implements IAbstractLogsTransportManager {
   /**
    * Creates graylog2 transports manager instance
    *
    * Post-conditions:
    *    - no default list of graylog inputs
    *    - no default recipe for system
    * */
   constructor();

   /**
    * Registers a new graylog2 input
    *
    * Post-conditions:
    *    - stores server endpoint for input
    *
    * @param   input       Input name, acting as an identifier
    * @param   endpoint    Options based on which transport will be created
    * @api public
    */
   register(input: string, endpoint: GrayLogsManager.IGraylogServer): void;

   /**
    * Defines a recipe for system, which instructs the manager
    * which log level and inputs to use for him.
    * @all system can be specified. This recipe will be used when no explicit
    * recipe was found for specified system.
    *
    * Post-conditions:
    *    - stores recipe in a provisory map
    *
    * @param system     Subsystem name
    * @param recipe     Subsystem recipe
    * @api public
    */
   recipeFor(system: string, recipe: GrayLogsManager.IRecipe): void;

   /**
    * When no inputs configured, it means graylog transport is not used.
    * Do not pass @all system name, as it will be removed.
    *
    * Pre-conditions:
    *    - system or @all recipe has to be defined, if graylog transport needs to be used
    *
    * Post-conditions:
    *    - creates transport for that system
    *    - removes his recipe, if it was defined explicitly
    *    - input options are not touched, as it may be needed for other systems
    *
    * @throws {Error}   When no recipe configured.
    *                   When input from recipe was not registered.
    * @api private
    */
   get: (system: string) => TransportStream | null;
}

declare namespace GrayLogsManager {
   /** Graylog options used for input */
   interface IGraylogServer {
       /** Host of the input server */
       host: string;
       /** Port of the input server */
       port: number;
   }
   /** Defines a recipe based on his new loggers will be created */
   interface IRecipe {
      /** Level used by that system */
      level: string;
      /** Graylog input where system will send logs */
      input: string;
   }
}

export default GrayLogsManager;
export { GrayLogsManager };
