import {
	Connection,
	Pool,
	PoolConnection,
	PoolOptions,
	QueryError
	// eslint-disable-next-line import/extensions
} from 'mysql2/promise';
import { escape } from 'mysql2';
import { logger } from './logger';
import { createException, ErrorCodes } from './error';
import { PoolClusterConfig, PoolClusterConnectionsManager } from './connections/cluster';
import { ConnectionsManager, QueryType } from './connections/interface';
import { PoolConnectionsManager } from './connections/pool';
import { formatConnectionDetails, formatMySqlError, mysqlErrorHandler } from './utils';

/**
 * Options needed for MySQL client initialization. <br/>
 * {@link MySQLClientOptions.pool} and {@link MySQLClientOptions.poolCluster} are mutually exclusive options.
 */
interface MySQLClientOptions {
	/**
	 * Configure client with pooled connections.
	 */
	pool?: PoolOptions;
	/**
	 * Configure client with pool cluster connections.
	 */
	poolCluster?: PoolClusterConfig;
	/**
	 * Queries to be executed after connection establishment in order to set session variables.
	 */
	sessionVariablesQueries?: Array<string>;
}

/**
 * MySQL client which: <br/>
 * 		- handles pooled connections in cluster/non-cluster modes <br/>
 * 		- abstracts write & read pools for cluster/non-cluster modes <br/>
 * 		- logs mysql related events
 */
class MySQLClient {
	private connections!: ConnectionsManager;

	/**
	 * Init client.
	 *
	 * @param options	Init options.
	 */
	public init(options: MySQLClientOptions): void {
		if (this.connections == null) {
			if (options.pool) {
				this.connections = new PoolConnectionsManager(options.pool);
			} else if (options.poolCluster) {
				this.connections = new PoolClusterConnectionsManager(options.poolCluster);
			} else {
				throw createException(ErrorCodes.MISCONFIGURATION, 'You need to provide either pool or pool cluster configurations.', options);
			}

			this.connections.init(MySQLClient.configurePool, options.sessionVariablesQueries);
		}
	}

	/**
	 * Shutdown client.
	 */
	public async shutdown(): Promise<void> {
		logger.notice('Shutting down gracefully...');
		await this.connections!.shutdown();
	}

	/**
	 * Get MySQL connection.
	 *
	 * @param type	Type of the connection.
	 */
	public getConnection(type: QueryType): Promise<PoolConnection> {
		return this.connections!.getConnection(type);
	}

	/**
	 * Escapes value before being part of SQL query.
	 *
	 * @param value		Value to be escaped.
	 *
	 * @returns			String escaped value.
	 */
	public escape(value: any): string {
		return escape(value);
	}

	private static configurePool(pool: Pool, sessionVariablesQueries?: Array<string>): void {
		pool.on('acquire', MySQLClient.logAcquirePoolEvent);
		pool.on('release', MySQLClient.logReleasePoolEvent);
		pool.on('enqueue', MySQLClient.logEnqueuePoolEvent);
		pool.on('connection', (connection: Connection): void => {
			logger.info(`Pool connection established with id ${connection.threadId}.`);

			if (sessionVariablesQueries) {
				for (const sessionVariableQuery of sessionVariablesQueries) {
					connection.query(sessionVariableQuery, (err: QueryError) => {
						logger.error(`Failed to execute query '${sessionVariableQuery}' on ${formatConnectionDetails(connection)}. ${formatMySqlError(err)}`);
					});
				}
			}

			connection.on('error', mysqlErrorHandler);
		});
	}

	private static logAcquirePoolEvent(connection: PoolConnection): void {
		logger.debug(`Connection ${connection.threadId} acquired.`);
	}

	private static logReleasePoolEvent(connection: PoolConnection): void {
		logger.debug(`Connection ${connection.threadId} released.`);
	}

	private static logEnqueuePoolEvent(): void {
		logger.debug('Pool is waiting for available connection slot.');
	}
}

export { MySQLClient, MySQLClientOptions };
