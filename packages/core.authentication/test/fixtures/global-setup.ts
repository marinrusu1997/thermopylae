import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { ClientModule } from '@thermopylae/core.declarations';
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { MySqlClientInstance, QueryType } from '@thermopylae/core.mysql';
import { initLogger as initMySqlLogger } from '@thermopylae/core.mysql';
import { type DebuggableEventType, type RedisConnectionOptions } from '@thermopylae/core.redis';
import { type MySqlConnectionDetails, logger } from '@thermopylae/dev.unit-test';
import fs from 'node:fs';
import path from 'node:path';
import { identify } from 'sql-query-identifier';
import type { GlobalSetupContext } from 'vitest/node';

let mysqlContainer: StartedMySqlContainer;
let redisContainer: StartedRedisContainer;

async function setup({ provide }: GlobalSetupContext): Promise<void> {
	/* MYSQL */
	mysqlContainer = await new MySqlContainer('mysql:latest').start();

	const mySqlConnectionDetails = Object.freeze({
		host: mysqlContainer.getHost(),
		port: mysqlContainer.getPort(),
		database: mysqlContainer.getDatabase(),
		user: mysqlContainer.getUsername(),
		password: mysqlContainer.getUserPassword()
	} satisfies MySqlConnectionDetails);

	LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[ClientModule.MYSQL]: 'info'
		}
	});
	LoggerManagerInstance.console.createTransport({ level: 'info' });
	initMySqlLogger();

	MySqlClientInstance.init({ pool: mySqlConnectionDetails });

	const mysqlWriteConnection = await MySqlClientInstance.getConnection(QueryType.WRITE);
	try {
		const statements = identify(await fs.promises.readFile(path.join(import.meta.dirname, 'setup.sql'), 'utf8'), {
			dialect: 'mysql',
			identifyTables: true,
			strict: true
		});
		for (const statement of statements) {
			await mysqlWriteConnection.execute(statement.text);
		}
	} finally {
		mysqlWriteConnection.release();
		await MySqlClientInstance.shutdown();
	}

	/* REDIS */
	redisContainer = await new RedisContainer('redis:latest').start();

	const redisConnectionOptions = Object.freeze({
		host: redisContainer.getHost(),
		port: redisContainer.getFirstMappedPort(),
		connect_timeout: 10_000,
		max_attempts: 10,
		retry_max_delay: 5_000,
		attachDebugListeners: new Set<DebuggableEventType>(['end', 'reconnecting'])
	} satisfies RedisConnectionOptions);

	provide(
		// @ts-ignore
		'connectionOptions',
		Object.freeze({
			mysql: mySqlConnectionDetails,
			redis: redisConnectionOptions
		})
	);
}

async function teardown(): Promise<void> {
	if (mysqlContainer) {
		await mysqlContainer.stop();
	} else {
		logger.warn(`MySQL container was not created by 'before' hook. Therefore, cleanup is not needed.`);
	}

	if (redisContainer) {
		await redisContainer.stop();
	} else {
		logger.warn(`Redis container was not created by 'before' hook. Therefore, cleanup is not needed.`);
	}
}

export { setup, teardown };
