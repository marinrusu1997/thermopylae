import { RedisClient } from './client';

const RedisClientInstance = new RedisClient();

export { RedisClientInstance };
export { ConnectionType, RedisModule } from './client';
export type { RedisClientOptions, NodeRedisClient, NodeRedisClientMulti, ConnectOptions, DebuggableEventType } from './client';
export { initLogger } from './logger';
