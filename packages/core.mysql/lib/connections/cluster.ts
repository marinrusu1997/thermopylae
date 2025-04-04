import type { ObjMap } from '@thermopylae/core.declarations';
import { type PoolNamespace, createPoolCluster } from 'mysql2/promise.js';
import {
	type PoolCluster,
	type PoolClusterOptions,
	type PoolConnection,
	type PoolOptions,
	// @ts-ignore Poor typings for this package
	PromisePoolConnection
} from 'mysql2/promise.js';
import { ErrorCodes, createException } from '../error.js';
import { logger } from '../logger.js';
import { mysqlErrorHandler } from '../utils.js';
import { type ConnectionsManager, type PoolConfigurator, QueryType } from './interface.js';

interface PoolClusterNodes {
	/** Configuration for each of the cluster nodes. */
	[NodeName: string]: PoolOptions;
}

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
			this.poolCluster.add(clusterNodeNames[i], options.nodes[clusterNodeNames[i]] as any);
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
		// @ts-ignore Poor typings for this package
		for (const nodeName in this.poolCluster._nodes) {
			// @ts-ignore Poor typings for this package
			configurator(this.poolCluster._nodes[nodeName].pool, configOptions);
		}
	}

	public shutdown(): Promise<void> {
		return new Promise((resolve, reject) => {
			// @ts-ignore Poor typings for this package
			this.poolCluster.end((err) => (err ? reject(err) : resolve()));
		});
	}
}

export { PoolClusterConnectionsManager, type PoolClusterNodes, type PoolClusterConfig };
