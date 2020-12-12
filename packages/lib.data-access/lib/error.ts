import { Exception } from '@marin/lib.error';
import { Clients } from '@marin/lib.utils/dist/declarations';

const enum ErrorCodes {
	MYSQL_SESSION_VARIABLE_QUERY_FAILED = 'MYSQL_SESSION_VARIABLE_QUERY_FAILED',
	MYSQL_MISCONFIGURATION_POOL_CONFIG_NAME = 'MYSQL_MISCONFIGURATION_POOL_CONFIG_NAME',
	MYSQL_MISCONFIGURATION_NOR_POOL_NOR_CLUSTER_CONFIG = 'MYSQL_MISCONFIGURATION_NOR_POOL_NOR_CLUSTER_CONFIG'
}

function createException(client: Clients, code: ErrorCodes, message: string, data?: any): Exception {
	return new Exception(client, code, message, data);
}

export { ErrorCodes, createException };
