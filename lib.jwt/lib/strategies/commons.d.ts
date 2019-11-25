import { VerifyOptions } from "jsonwebtoken";

/**
 * Retrieves Jwt from Express Request object
 * Can be retrieved from:
 *    - Authorization Header with Token or Bearer scheme
 *    - Querry param `jwt`
 *    - Body JSON param `jwt`
 *    - Cookies param `jwt`
 *
 * @param     req   Express Request object
 * @returns         String representation of the token
 */
declare function extractJWT(req: any): string | null;

/**
 * Resolves options which Authenticator should use.
 * Provides same opts object, with defaults for unspecified options.
 * Some options may be undefined, if no default, and no explicit values available.
 *
 * @param opts  Options object provided by client
 * @returns     Options object with default values for unspecified options
 */
declare function resolveBasicOptions(opts: IBasicJWTAuthenticatorOpts): IBasicJWTAuthenticatorOpts;

/**
 * Attempts to log an error when logger instance provided.
 *
 * @param err     Error which needs to be logged
 * @param msg     Custom message associated with the error
 * @param logger  Logger instance
 */
declare function tryToLogError(err: Error, msg: string,logger?: Logger);

/** Logger used by authenticators */
interface Logger {
  /** Logs an info about successful authentication */
  info: (msg: string) => void;
  /** Logs an error related to authentication process failure */
  error: (err: Error, msg: string) => void;
}

/** Basic configuration options for Jwt Authenticator */
declare interface IBasicJWTAuthenticatorOpts {
  /** Function which based on request context can provide custom token verify opts */
  readonly verifyOptsProvider?: (req: any) => VerifyOptions | undefined;
  /** Extractor function for retrieving jwt from request */
  readonly extractor?: (req: any) => string | null;
  /** Property on the req object where the decoded token payload has to be attached */
  readonly attach?: Array<string> | string;
  /** Logger which can be used by authenticators */
  readonly logger?: Logger;
}

export {
  extractJWT,
  resolveBasicOptions,
  tryToLogError,
  IBasicJWTAuthenticatorOpts,
  Logger
}
