import { Exception } from '@marin/lib.error/lib/exception';
import IOptions = SMS.IOptions;

/** Class responsible for SMS related operations */
declare class SMS {
   /** Default constructible singleton */
   constructor();

   /**
    * Inits the instance with required configuration
    *
    * @param opts
    *
    * @throws {Exception}     When already initialized
    */
   init(opts: IOptions): void;

   /**
    * Sends an SMS
    *
    * @param to      Telephone number where SMS needs to be sent, must use E.164 formatting ("+" and a country code)
    * @param body    SMS body
    *
    * @throws {Exception | Error}     When not initialized
    *
    * @returns SMS id
    */
   send(to: string, body: string): Promise<string>;
}

declare namespace SMS {
   interface IOptions {
      accountSid: string;
      authToken: string;
      fromNumber: string;
   }
}

export default SMS;
export { SMS };
