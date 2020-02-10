import { Connection, createPool, createPoolCluster, MysqlError, Pool, PoolCluster, PoolClusterConfig, PoolConfig } from 'mysql';
import { Modules } from '@marin/declarations/lib/modules';
import { getLogger } from './logger';

let poolCluster: PoolCluster;
let writePoll: Pool;
let readPool: Pool;

interface MySqlPoolClusterConfigs {
	[name: string]: PoolConfig;
}

interface MySqlOptions {
	poolConfigs: MySqlPoolClusterConfigs;
	sessionVariablesQueries?: Array<string>;
	poolClusterConfig?: PoolClusterConfig;
	debugMode?: boolean;
	pingInterval?: number; // minutes
}

function initMySQL(options: MySqlOptions): void {
	function handleMySqlError(error: MysqlError): void {
		getLogger(Modules.MYSQL_CLIENT).error(
			`Code: ${error.code}. Errno: ${error.errno}. Sql state marker: ${error.sqlStateMarker}. Sql state: ${error.sqlState}. Field count: ${error.fieldCount}. Fatal: ${error.fatal}. Sql: ${error.sql}. Sql message: ${error.sqlMessage}. `,
			error
		);
	}

	function handlePollConnectionEvent(connection: Connection): void {
		getLogger(Modules.MYSQL_CLIENT).debug(`Connected as id ${connection.threadId}. `);

		if (options.sessionVariablesQueries) {
			for (let i = options.sessionVariablesQueries.length; i >= 0; i--) {
				connection.query(options.sessionVariablesQueries![i], err => {
					throw err; // fatal error
				});
			}
		}

		if (options.pingInterval) {
			setInterval(() => {
				connection.ping(err => {
					if (err) {
						throw err; // fatal error
					}
					getLogger(Modules.MYSQL_CLIENT).debug(`Connection with id ${connection.threadId} responded with a pong.`);
				});
			}, options.pingInterval * 60 * 1000);
		}

		connection.on('error', handleMySqlError);
	}

	function configPool(pool: Pool): void {
		pool.on('connection', handlePollConnectionEvent);

		if (options.debugMode) {
			pool.on('acquire', connection => getLogger(Modules.MYSQL_CLIENT).debug(`Connection ${connection.threadId} acquired. `));
			pool.on('release', connection => getLogger(Modules.MYSQL_CLIENT).debug(`Connection ${connection.threadId} released. `));
			pool.on('enqueue', () => getLogger(Modules.MYSQL_CLIENT).debug('Waiting for available connection slot. '));
		}
		pool.on('error', handleMySqlError);
	}

	const poolConfigNames = Object.getOwnPropertyNames(options.poolConfigs);

	if (poolConfigNames.length === 1) {
		writePoll = createPool(options.poolConfigs[poolConfigNames[0]]);
		configPool(writePoll);
		readPool = writePoll;
		return;
	}

	poolCluster = createPoolCluster(options.poolClusterConfig);
	for (let i = poolConfigNames.length - 1; i >= 0; i--) {
		if (!/^(?:MASTER|SLAVE)-[a-f\d]+$/.test(poolConfigNames[i])) {
			throw new Error('Pool config name should match pattern: ^(?:MASTER|SLAVE)-[a-f\\d]+$');
		}
		poolCluster.add(poolConfigNames[i], options.poolConfigs[poolConfigNames[i]]);
	}

	if (options.debugMode) {
		poolCluster.on('remove', nodeId => getLogger(Modules.MYSQL_CLIENT).debug(`Node with id ${nodeId} has been removed. `));
		poolCluster.on('offline', nodeId => getLogger(Modules.MYSQL_CLIENT).debug(`Node with id ${nodeId} went offline. `));
	}
	poolCluster.on('error', handleMySqlError);

	writePoll = poolCluster.of('MASTER*');
	configPool(writePoll);

	readPool = poolCluster.of('SLAVE*');
	configPool(readPool);
}

function shutdownMySql(): Promise<void> {
	let resolve: Function;
	let reject: Function;
	const shutdownPromise = new Promise<void>((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	if (poolCluster) {
		poolCluster.end(err => (err ? reject(err) : resolve()));
	} else {
		writePoll.end(err => (err ? reject(err) : resolve()));
	}

	return shutdownPromise;
}

function getWritePool(): Pool {
	return writePoll;
}

function getReadPool(): Pool {
	return readPool;
}

export { initMySQL, shutdownMySql, getWritePool, getReadPool, Pool, PoolClusterConfig, PoolConfig, MySqlPoolClusterConfigs, MySqlOptions };
