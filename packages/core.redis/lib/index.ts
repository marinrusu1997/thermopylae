import { RedisClient } from './client.js';

const RedisClientInstance = new RedisClient();

export { RedisClientInstance };
export { ConnectionType, RedisModule } from './client.js';
export type { RedisConnectionOptions, NodeRedisClient, NodeRedisClientMulti, InitializationOptions, DebuggableEventType } from './client.js';
export { initLogger } from './logger.js';
export { ErrorCodes } from './error.js';
