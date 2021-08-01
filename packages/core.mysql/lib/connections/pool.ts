// eslint-disable-next-line import/extensions
import { createPool, Pool, PoolConnection, PoolOptions } from 'mysql2/promise';
import { ObjMap } from '@thermopylae/core.declarations';
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

	public init(configurator: PoolConfigurator, configOptions: ObjMap): void {
		return configurator(this.pool, configOptions);
	}

	public shutdown(): Promise<void> {
		return this.pool.end();
	}
}

export { PoolConnectionsManager };
