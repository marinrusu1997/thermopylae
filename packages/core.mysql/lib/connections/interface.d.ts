// eslint-disable-next-line import/extensions
import { Pool, PoolConnection } from 'mysql2/promise';
import { ObjMap } from '@thermopylae/core.declarations';

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
declare type PoolConfigurator = (pool: Pool, configOptions: ObjMap) => void;

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
	 * @param configurator        Configurator function.
	 * @param configOptions       Configurator options.
	 */
	init(configurator: PoolConfigurator, configOptions: ObjMap): void;

	/**
	 * Shutdown all connections.
	 */
	shutdown(): Promise<void>;
}

export { QueryType, PoolConfigurator, ConnectionsManager };
