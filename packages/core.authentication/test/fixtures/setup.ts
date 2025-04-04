import { ClientModule, DevModule } from '@thermopylae/core.declarations';
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { MySqlClientInstance, QueryType, initLogger as initMySqlLogger } from '@thermopylae/core.mysql';
import { ConnectionType, RedisClientInstance, initLogger as initRedisClientLogger } from '@thermopylae/core.redis';
import { type MySqlConnectionDetails, logger } from '@thermopylae/dev.unit-test';
import { beforeAll, beforeEach, inject } from 'vitest';
import { initialization } from './initialization-flag.js';

beforeAll(async () => {
	if (initialization.done) {
		return;
	}
	initialization.done = true;

	/* LOGGING */
	LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[DevModule.UNIT_TESTING]: 'debug',
			[ClientModule.MYSQL]: 'info',
			[ClientModule.REDIS]: 'info'
		}
	});
	LoggerManagerInstance.console.createTransport({ level: 'info' });

	initMySqlLogger();
	initRedisClientLogger();

	// @ts-ignore
	const { mysql, redis } = inject('connectionOptions');

	MySqlClientInstance.init({ pool: mysql });

	await RedisClientInstance.connect({
		[ConnectionType.REGULAR]: redis
	});
	logger.debug('Connected to Redis container');
}, 60_000);

beforeEach(async () => {
	// @ts-ignore
	const { mysql } = inject('connectionOptions') as { mysql: MySqlConnectionDetails };

	const mysqlReadConnection = await MySqlClientInstance.getConnection(QueryType.READ);
	const mysqlWriteConnection = await MySqlClientInstance.getConnection(QueryType.WRITE);
	try {
		const [tables] = await mysqlReadConnection.query('SHOW TABLES');
		// @ts-ignore it is iterable
		for (const table of tables) {
			const tableName = table[`Tables_in_${mysql.database}`];
			await mysqlWriteConnection.execute(`DELETE FROM ${tableName}`);
		}
	} finally {
		mysqlReadConnection.release();
		mysqlWriteConnection.release(); // @fixme do clean resource disposal with scope
	}
	await RedisClientInstance.client.flushall();
}, 60_000);

/*
afterAll(async () => {
    await Promise.all([
        MySqlClientInstance.shutdown(),
        RedisClientInstance.disconnect()
    ]);
}, 20_000);*/
