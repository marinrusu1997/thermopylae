import { RedisClient } from './redis';

const RedisClientInstance = new RedisClient();

export { RedisClientInstance };
export { ConnectOptions, RedisLibraryClientOptions, RedisLibraryClient } from './redis';
export { initLogger } from './logger';
