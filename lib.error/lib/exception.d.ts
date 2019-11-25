declare class Exception extends Error {
   public emitter: string;
   public code: string;
   public data: any;

   /**
    * Constructs exception instance
    *
    * @param emitter    Component which emitted this message
    * @param code       Error code
    * @param message    Error message
    * @param data       Additional data
    */
   constructor(emitter: string, code: string, message: string, data?: any);

   /** @inheritDoc */
   public toString(): string;
}
export default Exception;
export { Exception };
