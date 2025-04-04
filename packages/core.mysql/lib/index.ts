import { MySQLClient } from './client.js';

const MySqlClientInstance = new MySQLClient();

export { MySqlClientInstance };
export { QueryType } from './connections/interface.js';
export type { PoolClusterConfig, PoolClusterNodes } from './connections/cluster.js';
export { ErrorCodes } from './error.js';
export { initLogger } from './logger.js';
export type { MySQLClientOptions, DebuggableEventType } from './client.js';
export { formatMySqlError, typeCastBooleans } from './utils.js';

export type { ResultSetHeader, RowDataPacket } from 'mysql2';
