import type { ObjMap } from '@thermopylae/core.declarations';
import { type Pool, type PoolConnection, type PoolOptions, createPool } from 'mysql2/promise.js';
import type { ConnectionsManager, PoolConfigurator } from './interface.js';

/** @private */
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
