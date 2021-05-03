import { after, before } from 'mocha';
import { bootRedisContainer, initLogger as initUnitTestLogger, logger, DockerContainer, ConnectionDetails } from '@thermopylae/lib.unit-test';
import { RedisClientInstance, initLogger as initRedisClientLogger, RedisClientOptions, ConnectionType } from '@thermopylae/core.redis';
import { LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';
import { config as dotEnvConfig } from 'dotenv';

let redisContainer: DockerContainer;
before(async function boot() {
	this.timeout(120_000);

	const dotEnv = dotEnvConfig();
	if (dotEnv.error) {
		throw dotEnv.error;
	}

	LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, true);
	LoggerInstance.console.createTransport({ level: process.env.LOG_LEVEL || 'debug' });

	initUnitTestLogger();
	initRedisClientLogger();

	let connectDetails: ConnectionDetails;
	[redisContainer, connectDetails] = await bootRedisContainer();

	const redisClientOptions: RedisClientOptions = {
		...connectDetails,
		connect_timeout: 10_000,
		max_attempts: 10,
		retry_max_delay: 5_000
	};

	await RedisClientInstance.connect({
		[ConnectionType.REGULAR]: redisClientOptions,
		[ConnectionType.SUBSCRIBER]: redisClientOptions
	});

	await RedisClientInstance.client.flushall();
	await RedisClientInstance.client.config('SET', 'notify-keyspace-events', 'Kgxe');
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(10_000);

	await RedisClientInstance.disconnect();

	const proceed = [undefined, 1, '1', true, 'true', 'yes', 'y'];

	if (redisContainer) {
		if (proceed.includes(process.env.STOP_REDIS_CONTAINER_AFTER_TESTS)) {
			logger.info(`Stopping redis container with id ${redisContainer.id}`);
			await redisContainer.stop();
		}
		if (proceed.includes(process.env.REMOVE_REDIS_CONTAINER_AFTER_TESTS)) {
			logger.info(`Removing redis container with id ${redisContainer.id}`);
			await redisContainer.remove();
		}
	} else {
		logger.debug(`Redis container was not created by 'before' hook. Therefore, cleanup is not needed.`);
	}
});
