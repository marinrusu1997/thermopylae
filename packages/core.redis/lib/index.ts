import { RedisClient } from './client';

const RedisClientInstance = new RedisClient();

export { RedisClientInstance };
export { ConnectionType } from './client';
export type { RedisClientOptions } from './client';
export { initLogger } from './logger';
