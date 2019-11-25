/** This is the manager class of the library */
import { Jwt } from './auth/jwt';
/** Memory storages for blacklisting */
import { MemoryStorage } from './blacklisting/storage/memory';
import { RedisStorage } from './blacklisting/storage/redis';
/** Jwt Authentication Strategies */
/* Express */
import { JwtAuthMiddleware } from './strategies/express/express';
/* Passport */
import { JwtStrategy } from './strategies/passport/passport';

/** LIBRARY EXPORTS */
export { Jwt, MemoryStorage, RedisStorage, JwtAuthMiddleware, JwtStrategy };
