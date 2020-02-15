import { Connection, createPool, createPoolCluster, MysqlError, Pool, PoolCluster, PoolClusterConfig, PoolConfig } from 'mysql';
import { Modules } from '@marin/declarations/lib/modules';
import Exception from '@marin/lib.error';
import { getLogger } from './logger';

type ConnectionId = number;

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

const enum ErrorCodes {
	FATAL_ERROR = 'FATAL_ERROR',
	PING_FAILED = 'PING_FAILED',
	SESSION_VARIABLE_QUERY_FAILED = 'SESSION_VARIABLE_QUERY_FAILED',
	MISCONFIGURATION_POOL_CONFIG_NAME = 'MISCONFIGURATION_POOL_CONFIG_NAME',
	MISCONFIGURATION_NOR_POOL_NOR_CLUSTER_CONFIG = 'MISCONFIGURATION_NOR_POOL_NOR_CLUSTER_CONFIG'
}

// @ts-ignore
class PingingTracker {
	private readonly connectionPingTimeouts: Map<ConnectionId, NodeJS.Timeout> = new Map<ConnectionId, NodeJS.Timeout>();

	public track(connection: Connection, intervalInMs: number): void {
		const doPing = (): void => {
			connection.ping((error: MysqlError | null) => {
				if (error) {
					throw new Exception(Modules.MYSQL_CLIENT, ErrorCodes.PING_FAILED, formatConnectionDetails(connection), error); // fatal error
				}
				getLogger(Modules.MYSQL_CLIENT).info(`Ping confirmed. ${formatConnectionDetails(connection)}`);
				this.connectionPingTimeouts.set(connection.threadId!, setTimeout(doPing, intervalInMs));
			});
		};

		getLogger(Modules.MYSQL_CLIENT).debug(`Started pinging. ${formatConnectionDetails(connection)}`);
		this.connectionPingTimeouts.set(connection.threadId!, setTimeout(doPing, intervalInMs));
	}

	public unTrackSingle(connectionId: ConnectionId): void {
		getLogger(Modules.MYSQL_CLIENT).debug(`Stopping pinging for connection with id ${connectionId}.`);
		clearTimeout(this.connectionPingTimeouts.get(connectionId)!);
		this.connectionPingTimeouts.delete(connectionId);
	}

	public unTrackAll(): void {
		this.connectionPingTimeouts.forEach((timeoutId, connectionId) => {
			getLogger(Modules.MYSQL_CLIENT).debug(`Stopping pinging for connection with id ${connectionId}.`);
			clearTimeout(timeoutId);
		});
	}

	public reset(): void {
		this.connectionPingTimeouts.clear();
	}
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
								getLogger(Modules.MYSQL_CLIENT).error(
									`Failed to shutdown pool cluster after invalid pool config name detection. Error: ${formatMySqlError(err)}`,
									err
								);
							}
						});

						this.poolCluster = null;

						throw new Exception(
							Modules.MYSQL_CLIENT,
							ErrorCodes.MISCONFIGURATION_POOL_CONFIG_NAME,
							`${poolConfigName} should begin with MASTER or SLAVE`
						);
					}
					this.poolCluster.add(poolConfigName, options.poolCluster.pools[poolConfigName]);
				}

				this.poolCluster.on('online', nodeId => getLogger(Modules.MYSQL_CLIENT).notice(`Node with id ${nodeId} is online. `));
				this.poolCluster.on('offline', nodeId => getLogger(Modules.MYSQL_CLIENT).warning(`Node with id ${nodeId} went offline. `));
				this.poolCluster.on('remove', nodeId => getLogger(Modules.MYSQL_CLIENT).crit(`Node with id ${nodeId} has been removed. `));

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

			throw new Exception(Modules.MYSQL_CLIENT, ErrorCodes.MISCONFIGURATION_NOR_POOL_NOR_CLUSTER_CONFIG, '', options);
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
			if (err) {
				reject(err);
			} else {
				resolve();
			}
			this.reset();
		};

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
			getLogger(Modules.MYSQL_CLIENT).alert(`Connection Error: ${formatMySqlError(error)}`, error);
		};
	}

	private static createPollConnectionEventHandler(sessionVariablesQueries?: Array<string>): (con: Connection) => void {
		return (connection: Connection) => {
			getLogger(Modules.MYSQL_CLIENT).info(`Connected as id ${connection.threadId}. `);

			if (sessionVariablesQueries) {
				for (let i = sessionVariablesQueries.length - 1; i >= 0; i--) {
					connection.query(sessionVariablesQueries![i], err => {
						if (err) {
							throw new Exception(Modules.MYSQL_CLIENT, ErrorCodes.SESSION_VARIABLE_QUERY_FAILED, formatConnectionDetails(connection), err); // fatal error
						}
						getLogger(Modules.MYSQL_CLIENT).notice(`Session variable query '${sessionVariablesQueries![i]}' completed successfully.`);
					});
				}
			}

			connection.on('error', MySqlClient.createMySqlErrorHandler());
		};
	}

	private static configurePool(pool: Pool, sessionVariablesQueries?: Array<string>): void {
		pool.on('connection', MySqlClient.createPollConnectionEventHandler(sessionVariablesQueries));
		pool.on('acquire', connection => getLogger(Modules.MYSQL_CLIENT).debug(`Connection ${connection.threadId} acquired. `));
		pool.on('release', connection => getLogger(Modules.MYSQL_CLIENT).debug(`Connection ${connection.threadId} released. `));
		pool.on('enqueue', () => getLogger(Modules.MYSQL_CLIENT).debug('Waiting for available connection slot. '));
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

const MySqlClientInstance = new MySqlClient();

export { MySqlClientInstance, ErrorCodes, Pool, PoolClusterConfig, PoolConfig, MySqlPoolClusterConfigs, MySqlClientOptions, MysqlError };
