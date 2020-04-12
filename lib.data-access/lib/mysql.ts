import { Clients } from '@marin/lib.utils/dist/declarations';
import {
	Connection,
	createPool,
	createPoolCluster,
	MysqlError,
	Pool,
	PoolCluster,
	PoolConnection,
	PoolClusterConfig,
	PoolConfig,
	TypeCast,
	createConnection,
	QueryOptions,
	FieldInfo
} from 'mysql';
import { getLogger } from './logger';
import { ErrorCodes, createException } from './error';

interface MySqlPoolClusterConfigs {
	[name: string]: PoolConfig;
}

interface MySqlClientOptions {
	pool?: PoolConfig;
	sessionVariablesQueries?: Array<string>;
	poolCluster?: {
		cluster?: PoolClusterConfig;
		pools: MySqlPoolClusterConfigs;
	};
}

class MySqlClient {
	private poolCluster: PoolCluster | null = null;

	private internalWritePool: Pool | null = null;

	private internalReadPool: Pool | null = null;

	public init(options: MySqlClientOptions): void {
		if (!this.internalWritePool || !this.internalReadPool) {
			if (options.pool) {
				this.internalWritePool = createPool(options.pool);
				MySqlClient.configurePool(this.internalWritePool, options.sessionVariablesQueries);
				this.internalReadPool = this.internalWritePool;
				return;
			}

			if (options.poolCluster) {
				this.poolCluster = createPoolCluster(options.poolCluster.cluster);

				const poolConfigNames = Object.getOwnPropertyNames(options.poolCluster.pools);

				let poolConfigName: string;
				for (let i = poolConfigNames.length - 1; i >= 0; i--) {
					poolConfigName = poolConfigNames[i];
					if (!/^(?:MASTER|SLAVE)/.test(poolConfigName)) {
						this.poolCluster.end(err => {
							if (err) {
								getLogger(Clients.MYSQL).error(
									`Failed to shutdown pool cluster after invalid pool config name detection. Error: ${formatMySqlError(err)}`,
									err
								);
							}
						});

						this.poolCluster = null;

						throw createException(
							Clients.MYSQL,
							ErrorCodes.MYSQL_MISCONFIGURATION_POOL_CONFIG_NAME,
							`${poolConfigName} should begin with MASTER or SLAVE`
						);
					}
					this.poolCluster.add(poolConfigName, options.poolCluster.pools[poolConfigName]);
				}

				this.poolCluster.on('online', nodeId => getLogger(Clients.MYSQL).notice(`Node with id ${nodeId} is online. `));
				this.poolCluster.on('offline', nodeId => getLogger(Clients.MYSQL).warning(`Node with id ${nodeId} went offline. `));
				this.poolCluster.on('remove', nodeId => getLogger(Clients.MYSQL).crit(`Node with id ${nodeId} has been removed. `));

				this.internalWritePool = this.poolCluster.of('MASTER*');
				this.internalReadPool = this.poolCluster.of('SLAVE*');

				// @ts-ignore
				// eslint-disable-next-line no-restricted-syntax, guard-for-in, no-underscore-dangle
				for (const nodeName in this.poolCluster._nodes) {
					// @ts-ignore
					// eslint-disable-next-line no-underscore-dangle
					MySqlClient.configurePool(this.poolCluster._nodes[nodeName].pool, options.sessionVariablesQueries);
				}

				return;
			}

			throw createException(Clients.MYSQL, ErrorCodes.MYSQL_MISCONFIGURATION_NOR_POOL_NOR_CLUSTER_CONFIG, '', options);
		}
	}

	public shutdown(): Promise<void> {
		let resolve: Function;
		let reject: Function;
		const shutdownPromise = new Promise<void>((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});

		const shutdownCallback = (err: MysqlError): void => {
			this.reset();

			if (err) {
				return reject(err);
			}

			return resolve();
		};

		getLogger(Clients.MYSQL).notice('Shutting down gracefully...');

		if (this.poolCluster) {
			this.poolCluster.end(shutdownCallback);
		} else {
			this.internalWritePool!.end(shutdownCallback);
		}

		return shutdownPromise;
	}

	public get writePool(): Pool {
		return this.internalWritePool!;
	}

	public get readPool(): Pool {
		return this.internalReadPool!;
	}

	private reset(): void {
		this.poolCluster = null;
		this.internalWritePool = null;
		this.internalReadPool = null;
	}

	private static createMySqlErrorHandler(): (err: MysqlError) => void {
		return (error: MysqlError): void => {
			getLogger(Clients.MYSQL).alert(`Connection Error: ${formatMySqlError(error)}`, error);
		};
	}

	private static createPollConnectionEventHandler(sessionVariablesQueries?: Array<string>): (con: Connection) => void {
		return (connection: Connection): void => {
			getLogger(Clients.MYSQL).info(`Connected as id ${connection.threadId}. `);

			if (sessionVariablesQueries) {
				for (let i = sessionVariablesQueries.length - 1; i >= 0; i--) {
					connection.query(sessionVariablesQueries![i], err => {
						if (err) {
							throw createException(Clients.MYSQL, ErrorCodes.MYSQL_SESSION_VARIABLE_QUERY_FAILED, formatConnectionDetails(connection), err); // fatal error
						}
						getLogger(Clients.MYSQL).notice(`Session variable query '${sessionVariablesQueries![i]}' completed successfully.`);
					});
				}
			}

			connection.on('error', MySqlClient.createMySqlErrorHandler());
		};
	}

	private static configurePool(pool: Pool, sessionVariablesQueries?: Array<string>): void {
		pool.on('connection', MySqlClient.createPollConnectionEventHandler(sessionVariablesQueries));
	}
}

function formatConnectionDetails(connection: Connection): string {
	return `Connection: Id ${connection.threadId}; Host ${connection.config.host || connection.config.socketPath}; Port ${connection.config.port}; User ${
		connection.config.user
	}; Database ${connection.config.database}. `;
}

function formatMySqlError(error: MysqlError): string {
	return `Code: ${error.code}; Errno: ${error.errno}; Sql state marker: ${error.sqlStateMarker}; Sql state: ${error.sqlState}; Field count: ${error.fieldCount}; Fatal: ${error.fatal}; Sql: ${error.sql}; Sql message: ${error.sqlMessage}. `;
}

const typeCastBooleans: TypeCast = (field, next) => {
	if (field.type === 'TINY' && field.length === 1) {
		return field.string() === '1'; // 1 = true, 0 = false
	}
	return next();
};

interface OkPacket {
	fieldCount: number;
	affectedRows: number;
	insertId: number;
	serverStatus: number;
	warningCount: number;
	message: string;
	protocol41: boolean;
	changedRows: number;
}

interface QueryResult {
	results?: OkPacket | any;
	fields?: FieldInfo[];
}

function queryAsync(connection: Connection | Pool, options: string | QueryOptions, values?: any): Promise<QueryResult> {
	return new Promise<QueryResult>((resolve, reject) => {
		function queryHandler(err: MysqlError | null, results?: any, fields?: FieldInfo[]): void {
			if (err) {
				return reject(err);
			}
			return resolve({ results, fields });
		}

		return typeof values === 'undefined' ? connection.query(options, queryHandler) : connection.query(options as string, values, queryHandler);
	});
}

async function insertWithAssertion(
	connection: Connection | Pool,
	insertSQL: string,
	values?: any,
	errMsg = 'Failed to INSERT',
	noOfExpectedRows = 1
): Promise<QueryResult> {
	const queryResult = await queryAsync(connection, insertSQL, values);

	if (queryResult.results.affectedRows !== noOfExpectedRows) {
		throw new Error(errMsg);
	}

	return queryResult;
}

async function updateWithAssertion(
	connection: Connection | Pool,
	updateSQL: string,
	values?: any,
	errMsg = 'Failed to UPDATE',
	noOfExpectedRows = 1
): Promise<QueryResult> {
	const queryResult = await queryAsync(connection, updateSQL, values);

	if (queryResult.results.changedRows !== noOfExpectedRows) {
		throw new Error(errMsg);
	}

	return queryResult;
}

async function beginTransaction(connection: Connection): Promise<void> {
	return new Promise((resolve, reject) => connection.beginTransaction(err => (err ? reject(err) : resolve())));
}

async function commitTransaction(connection: Connection): Promise<void> {
	return new Promise((resolve, reject) => connection.commit(err => (err ? reject(err) : resolve(err))));
}

async function rollbackTransaction(connection: Connection): Promise<void> {
	return new Promise((resolve, reject) => connection.rollback(err => (err ? reject(err) : resolve(err))));
}

const MySqlClientInstance = new MySqlClient();

export {
	MySqlClientInstance,
	typeCastBooleans,
	queryAsync,
	insertWithAssertion,
	updateWithAssertion,
	createConnection,
	beginTransaction,
	commitTransaction,
	rollbackTransaction,
	Pool,
	PoolConnection,
	PoolClusterConfig,
	PoolConfig,
	MySqlPoolClusterConfigs,
	MySqlClientOptions,
	MysqlError,
	Connection,
	OkPacket,
	QueryResult
};
