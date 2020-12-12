import {VerifyOptions, SignOptions, JsonWebTokenError} from 'jsonwebtoken';
import { JWTBlacklist } from "../blacklisting/jwt-blacklist";
import { IIssuedJWTPayload, IJWTPayload } from "./jwt-payload";

/**
 * Class for handling Jwt Authentication
 */
declare class Jwt {
   /**
    *  Secret used to sign tokens
    *  Can be either the secret for HMAC algorithms or the PEM encoded private key for RSA and ECDSA
    * */
     // @ts-ignore
   private secret: string | Buffer | Jwt.IPubPrivKeys;
   /** Options used for signing and verifying Jwt's */
   private signVerifyOpts?: Jwt.ISignVerifyOpts;
   /** Blacklist Manager takes care of blacklisting */
   private blacklistManager?: JWTBlacklist;

   /**
    * Constructs an instance of Jwt Auth
    *
    * @param   opts     Opts for Jwt Auth
    * @throws {JsonWebTokenError}   When secret format is not valid
    */
   constructor(opts: Jwt.IJWTAuthOpts);

   /**
    * Creates Jwt token with signed payload
    *
    * @param      payload     Jwt Payload, should contain `iat` and `exp` properties
    * @param      options     How payload should be signed
    * @returns String representation of the signed Jwt
    * @throws {JsonWebTokenError}   When signing process fails
    *                               When no options provided when using RSA/ECDSA key pair
    */
   sign: (payload: IJWTPayload, options?: SignOptions) => string;

   /**
    * Checks if provided token is valid, using validation options.
    * Also checks if token is blacklisted, if blacklisting support was specified
    *
    * @param   token    String representation of the Jwt
    * @param   options  Validation options
    * @returns          Decoded payload of the Jwt
    * @throws {JsonWebTokenError}   When token is not valid
    *                               When no options provided when using RSA/ECDSA key pair
    */
   validate: (token: string, options?: VerifyOptions) => Promise<IIssuedJWTPayload>;

   /**
    * Returns the instance of the Blacklist Manager
    *
    * @throws {Error} When blacklisting support was not configured
    */
   blacklist: () => JWTBlacklist;
}

declare namespace Jwt {
   /** Private and Public key pair used for token signing and validation */
   interface IPubPrivKeys {
      // @ts-ignore
      readonly priv: string | Buffer;
      // @ts-ignore
      readonly pub: string | Buffer;
   }
   /** Config for signing and verifying Jwt's */
   interface ISignVerifyOpts {
      readonly sign?: SignOptions;
      readonly verify?: VerifyOptions;
   }
   /** Config for Jwt Auth class */
   interface IJWTAuthOpts {
      // @ts-ignore
      readonly secret: string | Buffer | IPubPrivKeys;
      readonly blacklisting: boolean;
      readonly signVerifyOpts?: ISignVerifyOpts;
   }
}

export {
   Jwt
}
