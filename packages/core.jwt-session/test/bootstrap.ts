import { after, before, beforeEach } from 'mocha';
import { bootRedisContainer, ConnectionDetails, DockerContainer, initLogger as initUnitTestLogger, logger } from '@thermopylae/lib.unit-test';
import { ConnectionType, initLogger as initRedisClientLogger, RedisClientInstance, RedisClientOptions } from '@thermopylae/core.redis';
import { DefaultFormatters, LoggerInstance, OutputFormat } from '@thermopylae/lib.logger';
import { Client, CoreModule, Library, MutableSome } from '@thermopylae/core.declarations';
import { config as dotEnvConfig } from 'dotenv';
import pickRandom from 'pick-random';
import { initLogger as initUserSessionCommonsLogger } from '@thermopylae/core.user-session.commons';
// eslint-disable-next-line import/extensions
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/avro';
// eslint-disable-next-line import/extensions
import { FAST_JSON_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/fast-json';
// eslint-disable-next-line import/extensions
import { JSON_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/json';
import type { UserSessionRedisStorageOptions } from '@thermopylae/core.user-session.commons';
import { options, refreshTokenStorageOptions, server } from './server';
import { initLogger as initCoreJwtSessionLogger } from '../lib/logger';
import { InvalidAccessTokensMemCache } from '../lib';

const SERVER_PORT = 7569;

// eslint-disable-next-line import/no-mutable-exports
let serverAddress: string;
let redisContainer: DockerContainer;

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
			[CoreModule.JWT_USER_SESSION]: 'info',
			[CoreModule.USER_SESSION_COMMONS]: 'info',
			[Library.UNIT_TEST]: 'error',
			[Client.REDIS]: 'info'
		}
	});
	LoggerInstance.console.createTransport({ level: process.env['LOG_LEVEL'] || 'debug' });

	initUnitTestLogger();
	initRedisClientLogger();
	initCoreJwtSessionLogger();
	initUserSessionCommonsLogger();

	let connectDetails: ConnectionDetails;
	[redisContainer, connectDetails] = await bootRedisContainer();

	const redisClientOptions: RedisClientOptions = {
		...connectDetails,
		connect_timeout: 10_000,
		max_attempts: 10,
		retry_max_delay: 5_000,
		attachDebugListeners: new Set(['end', 'reconnecting'])
	};

	await RedisClientInstance.connect({
		[ConnectionType.REGULAR]: {
			...redisClientOptions,
			detect_buffers: true
		},
		[ConnectionType.SUBSCRIBER]: redisClientOptions
	});

	await RedisClientInstance.client.config('SET', 'notify-keyspace-events', 'Kgxe');

	serverAddress = await server.listen(SERVER_PORT);
	logger.debug(`Fastify server listening on ${serverAddress}`);

	logger.crit('Refresh token storage has serialization schemas to user session metadata, which needs to be updated from time to time.');
});

beforeEach(async () => {
	await RedisClientInstance.client.flushall(); // flush storage
	(options.jwt.invalidationOptions.invalidAccessTokensCache as InvalidAccessTokensMemCache).clear(); // flush cache

	[(refreshTokenStorageOptions as MutableSome<UserSessionRedisStorageOptions, 'serializer'>).serializer] = pickRandom(
		[AVRO_SERIALIZER, FAST_JSON_SERIALIZER, JSON_SERIALIZER],
		{ count: 1 }
	);
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(10_000);

	if (serverAddress) {
		await server.close();
		logger.debug('Fastify server closed');
	}

	const proceed = [undefined, 1, '1', true, 'true', 'yes', 'y'];
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

	await RedisClientInstance.disconnect(false);
});

export { serverAddress };
