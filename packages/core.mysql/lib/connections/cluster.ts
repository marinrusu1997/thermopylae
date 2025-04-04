import type { ObjMap } from '@thermopylae/core.declarations';
import type { Pool } from 'mysql2/promise';
import { type PoolCluster, type PoolClusterOptions, type PoolConnection, type PoolNamespace, type PoolOptions, createPoolCluster } from 'mysql2/promise.js';
import { ErrorCodes, createException } from '../error.js';
import { logger } from '../logger.js';
import { mysqlErrorHandler } from '../utils.js';
import { type ConnectionsManager, type PoolConfigurator, QueryType } from './interface.js';

type PoolClusterNodes = Record<string, PoolOptions>;

interface PoolClusterConfig {
	/** Configuration for the whole cluster. */
	cluster?: PoolClusterOptions;
	/** Configuration for cluster nodes. */
	nodes: PoolClusterNodes;
}

/** @private */
class PoolClusterConnectionsManager implements ConnectionsManager {
	private static readonly CLUSTER_NODE_NAME_REGEX = /^(?:MASTER|SLAVE)/;

	private readonly poolCluster: PoolCluster;

	private readonly writePool: PoolNamespace;

	private readonly readPool: PoolNamespace;

	public constructor(options: PoolClusterConfig) {
		const clusterNodeNames = Object.getOwnPropertyNames(options.nodes);
		for (let i = clusterNodeNames.length - 1; i >= 0; i--) {
			if (!PoolClusterConnectionsManager.CLUSTER_NODE_NAME_REGEX.test(clusterNodeNames[i])) {
				throw createException(ErrorCodes.MISCONFIGURATION, `${clusterNodeNames[i]} should begin with MASTER or SLAVE`);
			}
		}

		this.poolCluster = createPoolCluster(options.cluster);

		for (let i = clusterNodeNames.length - 1; i >= 0; i--) {
			this.poolCluster.add(clusterNodeNames[i], options.nodes[clusterNodeNames[i]]);
		}

		this.poolCluster.on('online', (nodeId: number) => logger.notice(`Pool Cluster Node with id ${nodeId} is online.`));
		this.poolCluster.on('offline', (nodeId: number) => logger.warning(`Pool Cluster Node with id ${nodeId} went offline.`));
		this.poolCluster.on('remove', (nodeId) => logger.warning(`Pool Cluster Node with id ${nodeId} has been removed.`));
		this.poolCluster.on('warn', mysqlErrorHandler);

		this.writePool = this.poolCluster.of('MASTER*');
		this.readPool = this.poolCluster.of('SLAVE*');
	}

	public getConnection(type: QueryType): Promise<PoolConnection> {
		switch (type) {
			case QueryType.READ:
				return this.readPool.getConnection();
			case QueryType.WRITE:
				return this.writePool.getConnection();
			default:
				return Promise.reject(createException(ErrorCodes.UNKNOWN_CONNECTION_TYPE, `Unknown connection type: ${type}.`));
		}
	}

	public init(configurator: PoolConfigurator, configOptions: ObjMap): void {
		// @ts-expect-error Poor typings for this packageackage
		const nodes: Record<string, { pool: Pool }> = this.poolCluster._nodes;

		for (const nodeName in nodes) {
			if (Object.hasOwn(nodes, nodeName)) {
				configurator(nodes[nodeName].pool, configOptions);
			}
		}
	}

	public shutdown(): Promise<void> {
		return new Promise((resolve, reject) => {
			// @ts-expect-error-error Poor typings
			// oxlint-disable-next-line prefer-await-to-callbacks
			this.poolCluster.end((err: Error | null) => (err ? reject(err) : resolve()));
		});
	}
}

export { PoolClusterConnectionsManager, type PoolClusterNodes, type PoolClusterConfig };
