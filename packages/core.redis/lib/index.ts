import { RedisClient } from './client';

const RedisClientInstance = new RedisClient();

export { RedisClientInstance };
export { ConnectionType, RedisModule } from './client';
export type { RedisConnectionOptions, NodeRedisClient, NodeRedisClientMulti, InitializationOptions, DebuggableEventType } from './client';
export { initLogger } from './logger';
export { ErrorCodes } from './error';
