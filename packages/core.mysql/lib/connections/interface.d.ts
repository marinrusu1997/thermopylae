// eslint-disable-next-line import/extensions
import { Pool, PoolConnection } from 'mysql2/promise';

/**
 * Type of the queries that can be executed on the connection.
 */
declare const enum QueryType {
	/**
	 * Write queries (INSERT, UPDATE, DELETE etc.)
	 */
	WRITE,
	/**
	 * Read queries (SELECT, etc.)
	 */
	READ
}

/**
 * Configure pool after it's initialization.
 * @private
 */
declare type PoolConfigurator = (pool: Pool, sessionVariablesQueries?: Array<string>) => void;

/**
 * Manages MySQL connections.
 * @private
 */
declare interface ConnectionsManager {
	/**
	 * Obtain mysql connection.
	 *
	 * @param type  Type of the connection.
	 */
	getConnection(type: QueryType): Promise<PoolConnection>;

	/**
	 * Init manager.
	 *
	 * @param configurator                  Configurator function.
	 * @param sessionVariablesQueries       Session variables to be set on new connection.
	 */
	init(configurator: PoolConfigurator, sessionVariablesQueries?: Array<string>): void;

	/**
	 * Shutdown all connections.
	 */
	shutdown(): Promise<void>;
}

export { QueryType, PoolConfigurator, ConnectionsManager };
