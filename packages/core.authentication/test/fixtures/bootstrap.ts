import { after, before, beforeEach } from 'mocha';
import {
	bootMySqlContainer,
	MySqlConnectionDetails,
	DockerContainer,
	initLogger as initUnitTestLogger,
	logger,
	recreateMySqlDatabase,
	createMySqlStorageSchema,
	truncateMySqlTables,
	ConnectionDetails,
	bootRedisContainer
} from '@thermopylae/lib.unit-test';
import { DefaultFormatters, LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';
import { Client, CoreModule, Library } from '@thermopylae/core.declarations';
import { MySqlClientInstance, initLogger as initMySqlLogger } from '@thermopylae/core.mysql';
import { ConnectionType, DebuggableEventType, initLogger as initRedisClientLogger, RedisClientInstance, RedisClientOptions } from '@thermopylae/core.redis';
import { config as dotEnvConfig } from 'dotenv';

let mysqlContainer: DockerContainer;
let redisContainer: DockerContainer;

before(async function boot() {
	this.timeout(120_000);

	/* DOT ENV */

	const dotEnv = dotEnvConfig();
	if (dotEnv.error) {
		throw dotEnv.error;
	}

	/* LOGGING */
	LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[Library.UNIT_TEST]: process.env['UNIT_TEST_LOG_LEVEL'] as string,
			[CoreModule.AUTHENTICATION]: process.env['CORE_AUTHENTICATION_LOG_LEVEL'] as string,
			[Client.MYSQL]: process.env['MYSQL_LOG_LEVEL'] as string,
			[Client.REDIS]: process.env['REDIS_LOG_LEVEL'] as string
		}
	});
	LoggerInstance.console.createTransport({ level: process.env['LOG_LEVEL'] });

	initUnitTestLogger();
	initMySqlLogger();
	initRedisClientLogger();

	/* MYSQL */
	const schemaScriptLocation = process.env['SCHEMA_SCRIPT_LOCATION'] as string;

	let mySqlConnectionDetails: MySqlConnectionDetails;
	[mysqlContainer, mySqlConnectionDetails] = await bootMySqlContainer({ schemaScriptLocation });

	MySqlClientInstance.init({
		poolCluster: {
			nodes: {
				MASTER: mySqlConnectionDetails,
				SLAVE: mySqlConnectionDetails
			}
		}
	});

	if (process.env['MYSQL_ENV_DROP_SCHEMA_ON_START'] === 'true') {
		await recreateMySqlDatabase();
		await createMySqlStorageSchema(schemaScriptLocation);
	} else {
		await truncateMySqlTables();
	}

	/* REDIS */
	let redisConnectDetails: ConnectionDetails;
	[redisContainer, redisConnectDetails] = await bootRedisContainer();

	const redisClientOptions: RedisClientOptions = {
		...redisConnectDetails,
		connect_timeout: 10_000,
		max_attempts: 10,
		retry_max_delay: 5_000,
		attachDebugListeners: new Set<DebuggableEventType>(['end', 'reconnecting'])
	};

	await RedisClientInstance.connect({
		[ConnectionType.REGULAR]: redisClientOptions
	});
});

beforeEach(async () => {
	await truncateMySqlTables();
	await RedisClientInstance.client.flushall();
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(20_000);

	const proceed = [undefined, 1, '1', true, 'true', 'yes', 'y'];

	/* MYSQL */
	await MySqlClientInstance.shutdown();

	if (mysqlContainer) {
		if (proceed.includes(process.env['STOP_MYSQL_CONTAINER_AFTER_TESTS'])) {
			logger.info(`Stopping mysql container with id ${mysqlContainer.id}`);
			await mysqlContainer.stop();
		}
		if (proceed.includes(process.env['REMOVE_MYSQL_CONTAINER_AFTER_TESTS'])) {
			logger.info(`Removing mysql container with id ${mysqlContainer.id}`);
			await mysqlContainer.remove();
		}
	} else {
		logger.debug(`MySQL container was not created by 'before' hook. Therefore, cleanup is not needed.`);
	}

	/* REDIS */
	await RedisClientInstance.disconnect();

	if (redisContainer) {
		if (proceed.includes(process.env['STOP_REDIS_CONTAINER_AFTER_TESTS'])) {
			logger.info(`Stopping redis container with id ${redisContainer.id}`);
			await redisContainer.stop();
		}
		if (proceed.includes(process.env['REMOVE_REDIS_CONTAINER_AFTER_TESTS'])) {
			logger.info(`Removing redis container with id ${redisContainer.id}`);
			await redisContainer.remove();
		}
	} else {
		logger.debug(`Redis container was not created by 'before' hook. Therefore, cleanup is not needed.`);
	}
});