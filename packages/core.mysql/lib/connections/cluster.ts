import {
	createPoolCluster,
	PoolCluster,
	PoolClusterOptions,
	PoolConnection,
	PoolOptions,
	// @ts-ignore
	PromisePoolConnection
	// eslint-disable-next-line import/extensions
} from 'mysql2/promise';
import { ErrorCodes } from '@thermopylae/core.declarations';
import { createException } from '../error';
import { logger } from '../logger';
import { ConnectionsManager, PoolConfigurator, QueryType } from './interface';
import { mysqlErrorHandler } from '../utils';

interface PoolClusterNodes {
	/**
	 * Configuration for each of the cluster nodes.
	 */
	[NodeName: string]: PoolOptions;
}

interface PoolClusterConfig {
	/**
	 * Configuration for the whole cluster.
	 */
	cluster?: PoolClusterOptions;
	/**
	 * Configuration for cluster nodes.
	 */
	nodes: PoolClusterNodes;
}

/**
 * @private
 */
class PoolClusterConnectionsManager implements ConnectionsManager {
	private static readonly CLUSTER_NODE_NAME_REGEX = /^(?:MASTER|SLAVE)/;

	private readonly poolCluster: PoolCluster;

	private readonly writePool: PoolCluster;

	private readonly readPool: PoolCluster;

	public constructor(options: PoolClusterConfig) {
		const clusterNodeNames = Object.getOwnPropertyNames(options.nodes);
		for (let i = clusterNodeNames.length - 1; i >= 0; i--) {
			if (!PoolClusterConnectionsManager.CLUSTER_NODE_NAME_REGEX.test(clusterNodeNames[i])) {
				throw createException(ErrorCodes.MISCONFIGURATION, `${clusterNodeNames[i]} should begin with MASTER or SLAVE`);
			}
		}

		this.poolCluster = createPoolCluster(options.cluster);

		for (let i = clusterNodeNames.length - 1; i >= 0; i--) {
			// @ts-ignore
			this.poolCluster.add(clusterNodeNames[i], options.poolCluster.nodes[clusterNodeNames[i]]);
		}

		this.poolCluster.on('online', (nodeId: number) => logger.notice(`Node with id ${nodeId} is online.`));
		this.poolCluster.on('offline', (nodeId: number) => logger.warning(`Node with id ${nodeId} went offline.`));
		this.poolCluster.on('remove', (nodeId) => logger.warning(`Node with id ${nodeId} has been removed.`));
		this.poolCluster.on('warn', mysqlErrorHandler);

		this.writePool = this.poolCluster.of('MASTER*');
		this.readPool = this.poolCluster.of('SLAVE*');
	}

	public getConnection(type: QueryType): Promise<PoolConnection> {
		switch (type) {
			case QueryType.READ:
				return new Promise<PoolConnection>((resolve, reject) => {
					this.readPool.getConnection((err, connection) => {
						return err ? reject(err) : resolve(new PromisePoolConnection(connection));
					});
				});
			case QueryType.WRITE:
				return new Promise<PoolConnection>((resolve, reject) => {
					this.writePool.getConnection((err, connection) => {
						return err ? reject(err) : resolve(new PromisePoolConnection(connection));
					});
				});
			default:
				return Promise.reject(createException(ErrorCodes.UNKNOWN, `Unknown connection type: ${type}.`));
		}
	}

	public init(configurator: PoolConfigurator, sessionVariablesQueries?: Array<string>): void {
		// @ts-ignore
		// eslint-disable-next-line no-restricted-syntax, guard-for-in, no-underscore-dangle
		for (const nodeName in this.poolCluster._nodes) {
			// @ts-ignore
			// eslint-disable-next-line no-underscore-dangle
			configurator(this.poolCluster._nodes[nodeName].pool, sessionVariablesQueries);
		}
	}

	public shutdown(): Promise<void> {
		return new Promise((resolve, reject) => {
			// @ts-ignore
			this.poolCluster.end((err) => (err ? reject(err) : resolve()));
		});
	}
}

export { PoolClusterConnectionsManager, PoolClusterNodes, PoolClusterConfig };