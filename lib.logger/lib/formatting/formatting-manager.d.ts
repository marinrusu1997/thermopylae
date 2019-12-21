import { Format } from 'logform';
/** Class responsible for formatters managing */
declare class FormattingManager {
   /**
    * Constructs manager for configuring log output
    *
    * Post-conditions:
    *    - instance will have a predefined formatters map (name => formatter)
    *    - instance will have a predefined orders recipe
    */
   constructor();

   /**
    * Adds/Replaces a formatter into known formatters list.
    *
    * Post-conditions:
    *    - existing formatters will be overwritten by this method
    *    - order recipe is discarded, reconfiguration is needed later
    *
    * @param   name        Name of the formatter
    * @param   formatter   Formatter instance, must be winston compliant
    */
   set(name: string, formatter: Format): void;

   /**
    * Removes existing formatter from known formatters list.
    *
    * Pre-conditions:
    *    - formatter must exist in the list
    *    - order recipe is discarded, reconfiguration is needed later
    *
    * @param   name  Formatter name
    */
   remove(name: string): void;

   /**
    * Specifies a custom recipe which instructs in which order formatters needs to be combined.
    *
    * Pre-conditions:
    *    - order recipe does not need to be configured
    *
    * @throws {Error}   When a order recipe is configured already
    */
   order(recipe: Array<string>): void;

   /**
    * Configures a recipe from a predefined set.
    *
    * Post-conditions:
    *    - if a recipe exists, it will be rewritten
    *
    * @param   output      Desired output
    * @param   colorize    Specify if colored output is desired
    * @throws {Error}      When desired output is not supported
    */
   applyOrderFor(output: FormattingManager.OutputFormat, colorize?: boolean): void;

   /**
    * Returns a formatter object for winston, which combines all known formatters.
    * Formatters order will be in the order specified by order recipe.
    * Label formatter will be set based on system name.
    *
    * Pre-conditions:
    *    - order recipe has to be configured
    *
    * @param   system   Subsystem/service name
    * @throws {Error}      When no order recipe configured
    */
   formatterFor(system: string): Format;
}

declare namespace FormattingManager {
   const enum OutputFormat {
      PRINTF = "PRINTF",
      JSON = "JSON",
      PRETTY_PRINT = "PRETTY_PRINT"
   }
}

export default FormattingManager;
export { FormattingManager };
