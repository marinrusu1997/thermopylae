import { Jwt } from "../../auth/jwt";
import { IBasicJWTAuthenticatorOpts, Logger } from "../commons";

/**
 * Middleware used by Express framework
 */
type Middleware = (req: object, res: object, next: Function) => void;
/**
 * Custom handler for the case when authentication fails due to an error, or invalid token.
 * Handler can be called in two combinations:
 *    - with error and null status => it means something went wrong, but it's not related to token validation
 *    - with error and false status => it means token validation failed, and error specifies why
 * Express response object is passed always.
 *
 * @param err     Error which indicates why authentication failed
 * @param status  Status which indicates that authentication failed due to invalid token.
 * @param res     Express response object
 */
type FailureHandler = (err: Error, status: boolean | null, res: any) => Promise<void>;

/**
 * Jwt Authenticator Express Middleware factory function.
 *
 *
 * @param auth  Configured Jwt object which contains validation logic
 * @param opts  Token verify options and extractor function
 * @returns     Middleware which contains jwt auth business logic
 * @constructor
 * @api public
 */
declare function JwtAuthMiddleware(auth: Jwt, opts?: JwtAuthMiddleware.IExpressMiddlewareOpts): Middleware;

/**
 * Resolves options which Express Authenticator should use.
 * Provides same opts object, with defaults for unspecified options.
 * Some options may be undefined, if no default, and no explicit values available.
 *
 * @param opts  Options provided by client.
 * @returns     Options object with default values for unspecified options.
 * @api private
 */
declare function resolveMiddlewareOpts(opts: JwtAuthMiddleware.IExpressMiddlewareOpts):
  JwtAuthMiddleware.IExpressMiddlewareOpts;

/**
 * Provides the predefined failure handler, with logging support.
 * On non jwt related err responses with 500 `Server Error. Authentication failed`
 * On jwt related err responses with 401 Unauthorized followed by cause (i.e blacklisted, expired)
 *
 * @param   logger    Logger instance
 * @returns           Default failure handler
 * @api private
 */
declare function getDefaultFailureHandler(logger?: Logger): FailureHandler;

declare namespace JwtAuthMiddleware {

  /** Configuration options for express-unless middleware */
  interface IUnlessOpts {
    /** Method or array of methods */
    readonly method?: string | Array<string>;
    /** Array of paths, regex, or path and method */
    readonly path?: string | RegExp | Array<string | RegExp> | Array<{method: string; url: string | RegExp;}>;
    readonly ext?: string | Array<string>;
    readonly custom?: (req: object) => boolean;
    readonly useOriginalUrl?: boolean;
  }
  /** Configuration options for Jwt Auth Express Middleware */
  interface IExpressMiddlewareOpts extends IBasicJWTAuthenticatorOpts {
    /** Specify which paths should be unprotected */
    readonly unless?: IUnlessOpts;
    /** Failure handler */
    readonly onFailure?: FailureHandler;
  }
}

export {
  JwtAuthMiddleware,
  getDefaultFailureHandler
};
