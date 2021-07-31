import { MySQLClient } from './client';

const MySqlClientInstance = new MySQLClient();

export { MySqlClientInstance };
export { QueryType } from './connections/interface';
export { PoolClusterConfig, PoolClusterNodes } from './connections/cluster';
export { ErrorCodes } from './error';
export { initLogger } from './logger';
export { MySQLClientOptions } from './client';
export { formatMySqlError, typeCastBooleans } from './utils';

export { ResultSetHeader, RowDataPacket } from 'mysql2';
