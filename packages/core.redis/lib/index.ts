import { RedisClient } from './client';

const RedisClientInstance = new RedisClient();

export { RedisClientInstance };
export { ConnectOptions, ClientOpts } from './client';
export { initLogger } from './logger';
