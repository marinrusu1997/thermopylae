import { after, before } from 'mocha';
import { bootRedisContainer, initLogger as initUnitTestLogger, DockerContainer, ConnectionDetails } from '@thermopylae/lib.unit-test';
import { RedisClientInstance, initLogger as initRedisClientLogger, RedisClientOptions, ConnectionType } from '@thermopylae/core.redis';
import { LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';

let redisContainer: DockerContainer;
before(async function boot() {
	this.timeout(120_000);

	LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, true);
	LoggerInstance.console.createTransport({ level: process.env.LOG_LEVEL || 'debug' });

	initUnitTestLogger();
	initRedisClientLogger();

	let connectDetails: ConnectionDetails;
	[redisContainer, connectDetails] = await bootRedisContainer(20);

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
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(10_000);

	await RedisClientInstance.disconnect();
	await redisContainer.stop();
});
