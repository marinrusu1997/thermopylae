import { createPool, createPoolCluster, Pool, PoolCluster, PoolClusterConfig, PoolConfig } from 'mysql';
import { Modules } from '@marin/declarations/lib/modules';
import { getLogger } from './logger';

let poolCluster: PoolCluster;
let writePoll: Pool;
let readPool: Pool;

interface PoolConfigs {
	[name: string]: PoolConfig;
}

function initMySQL(poolConfigs: PoolConfigs, poolClusterConfig?: PoolClusterConfig): void {
	const poolConfigNames = Object.getOwnPropertyNames(poolConfigs);
	if (poolConfigNames.length === 1) {
		writePoll = createPool(poolConfigs[poolConfigNames[0]]);
		readPool = writePoll;
	} else {
		poolCluster = createPoolCluster(poolClusterConfig);
		for (let i = poolConfigNames.length - 1; i >= 0; i--) {
			poolCluster.add(poolConfigNames[i], poolConfigs[poolConfigNames[i]]);
		}

		poolCluster.on('remove', nodeId => getLogger(Modules.MYSQL_CLIENT).warning(`Node with id ${nodeId} has been removed.`));
		poolCluster.on('offline', nodeId => getLogger(Modules.MYSQL_CLIENT).warning(`Node with id ${nodeId} went offline.`));

		writePoll = poolCluster.of('MASTER*');
		readPool = poolCluster.of('SLAVE*');
	}
}
