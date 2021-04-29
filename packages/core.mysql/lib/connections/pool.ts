// eslint-disable-next-line import/extensions
import { createPool, Pool, PoolConnection, PoolOptions } from 'mysql2/promise';
import { ConnectionsManager, PoolConfigurator } from './interface';

/**
 * @private
 */
class PoolConnectionsManager implements ConnectionsManager {
	private readonly pool: Pool;

	public constructor(options: PoolOptions) {
		this.pool = createPool(options);
	}

	public getConnection(): Promise<PoolConnection> {
		return this.pool.getConnection();
	}

	public init(configurator: PoolConfigurator, sessionVariablesQueries?: Array<string>): void {
		return configurator(this.pool, sessionVariablesQueries);
	}

	public shutdown(): Promise<void> {
		return this.pool.end();
	}
}

export { PoolConnectionsManager };
