import { after, before, beforeEach } from 'mocha';
import {
	bootMySqlContainer,
	MySqlConnectionDetails,
	DockerContainer,
	initLogger as initUnitTestLogger,
	logger,
	recreateMySqlDatabase,
	createMySqlStorageSchema,
	truncateMySqlTables
} from '@thermopylae/lib.unit-test';
import { DefaultFormatters, LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';
import { Client, CoreModule, Library } from '@thermopylae/core.declarations';
import { MySqlClientInstance, initLogger as initMySqlLogger } from '@thermopylae/core.mysql';
import { config as dotEnvConfig } from 'dotenv';

let mysqlContainer: DockerContainer;

before(async function boot() {
	this.timeout(120_000);

	const dotEnv = dotEnvConfig();
	if (dotEnv.error) {
		throw dotEnv.error;
	}

	LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[Library.UNIT_TEST]: process.env['UNIT_TEST_LOG_LEVEL'] as string,
			[CoreModule.AUTHENTICATION]: process.env['CORE_AUTHENTICATION_LOG_LEVEL'] as string,
			[Client.MYSQL]: process.env['MYSQL_LOG_LEVEL'] as string
		}
	});
	LoggerInstance.console.createTransport({ level: process.env['LOG_LEVEL'] });

	initUnitTestLogger();
	initMySqlLogger();

	const schemaScriptLocation = process.env['SCHEMA_SCRIPT_LOCATION'] as string;

	let connectDetails: MySqlConnectionDetails;
	[mysqlContainer, connectDetails] = await bootMySqlContainer({ schemaScriptLocation });

	MySqlClientInstance.init({
		poolCluster: {
			nodes: {
				MASTER: connectDetails,
				SLAVE: connectDetails
			}
		}
	});

	if (process.env['MYSQL_ENV_DROP_SCHEMA_ON_START'] === 'true') {
		await recreateMySqlDatabase();
		await createMySqlStorageSchema(schemaScriptLocation);
	} else {
		await truncateMySqlTables();
	}
});

beforeEach(async () => {
	await truncateMySqlTables();
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(10_000);

	await MySqlClientInstance.shutdown();

	const proceed = [undefined, 1, '1', true, 'true', 'yes', 'y'];
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
});
