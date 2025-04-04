import { escape } from 'mysql2';
import type { Connection, Pool, PoolConnection, PoolOptions, QueryError } from 'mysql2/promise.js';
import { type PoolClusterConfig, PoolClusterConnectionsManager } from './connections/cluster.js';
import { type ConnectionsManager, QueryType } from './connections/interface.js';
import { PoolConnectionsManager } from './connections/pool.js';
import { ErrorCodes, createException } from './error.js';
import { logger } from './logger.js';
import { formatConnectionDetails, formatMySqlError, mysqlErrorHandler } from './utils.js';

/**
 * Type of the [events](https://www.npmjs.com/package/mysql#pool-events) on which debug listener can
 * be attached. <br/> Whenever the event is emitted, listener will log this event along with it's
 * arguments.
 */
type DebuggableEventType = 'acquire' | 'release' | 'enqueue' | 'connection';

/**
 * Options needed for MySQL client initialization. <br/> {@link MySQLClientOptions.pool} and
 * {@link MySQLClientOptions.poolCluster} are mutually exclusive options.
 */
interface MySQLClientOptions {
	/** Configure client with pooled connections. */
	readonly pool?: PoolOptions;
	/** Configure client with pool cluster connections. */
	readonly poolCluster?: PoolClusterConfig;
	/** Queries to be executed after connection establishment in order to set session variables. */
	readonly sessionVariablesQueries?: Array<string>;
	/**
	 * Whether debug listeners need to be attached on pool. <br/> Depending on value of this param,
	 * following actions will be taken: <br/> * undefined | false - debug listeners won't be
	 * attached <br/> * true - debug listeners will be attached for all {@link DebuggableEventType}
	 * <br/>
	 *
	 * - Set<DebuggableEventType> - debug listeners will be attached only to specified events.
	 */
	readonly attachDebugListeners?: boolean | Set<DebuggableEventType>;
}

/**
 * MySQL client which: <br/> - handles pooled connections in cluster/non-cluster modes <br/> -
 * abstracts write & read pools for cluster/non-cluster modes <br/> - logs mysql related events.
 */
class MySQLClient {
	private connections!: ConnectionsManager;

	/**
	 * Init client.
	 *
	 * @param options Init options.
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

			this.connections.init(MySQLClient.configurePool, options);
		}
	}

	/** Shutdown client. */
	public async shutdown(): Promise<void> {
		logger.notice('Shutting down gracefully...');
		await this.connections!.shutdown();
	}

	/**
	 * Get MySQL connection.
	 *
	 * @param type Type of the connection.
	 */
	public getConnection(type: QueryType): Promise<PoolConnection> {
		return this.connections!.getConnection(type);
	}

	/**
	 * Escapes value before being part of SQL query.
	 *
	 * @param   value Value to be escaped.
	 *
	 * @returns       String escaped value.
	 */
	public escape(value: any): string {
		return escape(value);
	}

	private static configurePool(pool: Pool, options: MySQLClientOptions): void {
		if (options.attachDebugListeners) {
			if (options.attachDebugListeners === true) {
				pool.on('acquire', MySQLClient.logAcquirePoolEvent);
				pool.on('release', MySQLClient.logReleasePoolEvent);
				pool.on('enqueue', MySQLClient.logEnqueuePoolEvent);
			} else {
				if (options.attachDebugListeners.has('acquire')) {
					pool.on('acquire', MySQLClient.logAcquirePoolEvent);
				}
				if (options.attachDebugListeners.has('release')) {
					pool.on('release', MySQLClient.logReleasePoolEvent);
				}
				if (options.attachDebugListeners.has('enqueue')) {
					pool.on('enqueue', MySQLClient.logEnqueuePoolEvent);
				}
			}
		}

		pool.on('connection', (connection: Connection): void => {
			if (options.attachDebugListeners && (options.attachDebugListeners === true || options.attachDebugListeners.has('connection'))) {
				logger.debug(`Pool connection established with id ${connection.threadId}.`);
			}

			if (options.sessionVariablesQueries) {
				for (const sessionVariableQuery of options.sessionVariablesQueries) {
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

export { MySQLClient, type MySQLClientOptions, type DebuggableEventType };
