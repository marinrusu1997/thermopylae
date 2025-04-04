import jsonwebtoken from 'jsonwebtoken';

const { JsonWebTokenError, NotBeforeError, TokenExpiredError } = jsonwebtoken;

export { JsonWebTokenError, NotBeforeError, TokenExpiredError };
export { JwtUserSessionManager, JwtUserSessionManagerEvent } from './manager.js';
export { ErrorCodes } from './error.js';

export type { JwtUserSessionManagerOptions, JwtSignOptions, JwtVerifyOptions, SessionTokens } from './manager.js';
export type { JwtPayload, IssuedJwtPayload } from './declarations.js';
export type { InvalidationStrategyOptions } from './invalidation.js';
export type { InvalidAccessTokensCache } from './cache.js';
