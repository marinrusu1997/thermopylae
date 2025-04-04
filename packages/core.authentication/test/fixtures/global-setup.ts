import { MySqlContainer, type StartedMySqlContainer } from '@testcontainers/mysql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { ClientModule } from '@thermopylae/core.declarations';
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { MySqlClientInstance, QueryType, initLogger as initMySqlLogger } from '@thermopylae/core.mysql';
import type { DebuggableEventType, RedisConnectionOptions } from '@thermopylae/core.redis';
import { type MySqlConnectionDetails, logger } from '@thermopylae/dev.unit-test';
import fs from 'node:fs';
import path from 'node:path';
import { identify } from 'sql-query-identifier';
import type { GlobalSetupContext } from 'vitest/node';

let mysqlContainer: StartedMySqlContainer | null = null;
let redisContainer: StartedRedisContainer | null = null;

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
			// oxlint-disable-next-line no-await-in-loop
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
		retry_max_delay: 5000,
		attachDebugListeners: new Set<DebuggableEventType>(['end', 'reconnecting'])
	} satisfies RedisConnectionOptions);

	provide(
		// @ts-expect-error-error
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
