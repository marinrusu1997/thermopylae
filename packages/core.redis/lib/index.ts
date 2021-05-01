import { RedisClient } from './client';

const RedisClientInstance = new RedisClient();

export { RedisClientInstance };
export { ConnectOptions } from './client';
export { initLogger } from './logger';
