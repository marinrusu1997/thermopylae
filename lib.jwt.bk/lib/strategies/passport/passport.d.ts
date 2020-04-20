import { Jwt } from "../../auth/jwt";
import { Strategy } from "passport-custom";
import { IBasicJWTAuthenticatorOpts } from "../commons";

/**
 * Factory function which creates Passport Jwt Auth Strategy instance.
 * When a logger instance will be provided, this strategy
 * will log all failed attempts to onGet the protected endpoint with their
 * corresponding request object.
 *
 * @param auth  Configured Jwt object which contains validation logic
 * @param opts  Token verify options and extractor function
 * @returns     Passport Strategy
 * @api public
 */
declare function JwtStrategy(auth: Jwt, opts?: JwtStrategy.IPassportJWTOpts): Strategy;

/**
 * Functor which generates a function to validate Jwt
 * For the attach property, lodash.set is used. More details here: https://lodash.com/docs/4.17.15#set
 *
 * @param auth  Configured Jwt object which contains validation logic
 * @param opts  Configurations for strategy
 * @constructor Generates function with validation logic
 * @api private
 */
declare function Authenticator(auth: Jwt, opts?: JwtStrategy.IPassportJWTOpts): (req: any, done: Function) => void;

declare namespace JwtStrategy {
  /** Configuration options for Jwt Passport Strategy */
  type IPassportJWTOpts = IBasicJWTAuthenticatorOpts;
}

export {
  JwtStrategy,
  Authenticator
}
