import { SignOptions, VerifyOptions } from "jsonwebtoken";
/** This is the manager class of the library */
import { Jwt } from './auth/jwt';
import { IIssuedJWTPayload } from './auth/jwt-payload';
/** Memory storages for blacklisting */
import { MemoryStorage } from './blacklisting/storage/memory';
import { RedisStorage } from './blacklisting/storage/redis';
/** Jwt Authentication Strategies */
/* Express */
import { JwtAuthMiddleware } from './strategies/express/express';
/* Passport */
import { JwtStrategy } from './strategies/passport/passport';

/** LIBRARY EXPORTS */
export { Jwt, SignOptions, VerifyOptions, IIssuedJWTPayload, MemoryStorage, RedisStorage, JwtAuthMiddleware, JwtStrategy };
