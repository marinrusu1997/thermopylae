import { ClientModule, CoreModule, DevModule, type MutableSome } from '@thermopylae/core.declarations';
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { ConnectionType, RedisClientInstance, type RedisConnectionOptions, initLogger as initRedisClientLogger } from '@thermopylae/core.redis';
import { initLogger as initUserSessionCommonsLogger } from '@thermopylae/core.user-session.commons';
import type { UserSessionRedisStorageOptions } from '@thermopylae/core.user-session.commons';
import { AVRO_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/avro.js';
import { FAST_JSON_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/fast-json.js';
import { JSON_SERIALIZER } from '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/json.js';
import { logger } from '@thermopylae/dev.unit-test';
import pickRandom from 'pick-random';
import { RedisMemoryServer } from 'redis-memory-server';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { InvalidAccessTokensMemCache } from '../lib/index.js';
import { initLogger as initCoreJwtSessionLogger } from '../lib/logger.js';
import { options, refreshTokenStorageOptions, server } from './server.js';

const SERVER_PORT = 7569;

let serverAddress: string;
let redisMemoryServer: RedisMemoryServer;

beforeAll(async function boot() {
	LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[CoreModule.JWT_USER_SESSION]: 'info',
			[CoreModule.USER_SESSION_COMMONS]: 'info',
			[DevModule.UNIT_TESTING]: 'error',
			[ClientModule.REDIS]: 'info'
		}
	});
	LoggerManagerInstance.console.createTransport({ level: 'debug' });

	initRedisClientLogger();
	initCoreJwtSessionLogger();
	initUserSessionCommonsLogger();

	redisMemoryServer = new RedisMemoryServer();
	if (!(await redisMemoryServer.start())) {
		throw new Error('Failed to start redis memory server');
	}

	const redisClientOptions: RedisConnectionOptions = {
		host: await redisMemoryServer.getHost(),
		port: await redisMemoryServer.getPort(),
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

	serverAddress = await server.listen({ port: SERVER_PORT });
	logger.debug(`Fastify server listening on ${serverAddress}`);

	logger.error('Refresh token storage has serialization schemas to user session metadata, which needs to be updated from time to time.');
}, 120_000);

beforeEach(async () => {
	await RedisClientInstance.client.flushall(); // flush storage
	(options.jwt.invalidationOptions.invalidAccessTokensCache as InvalidAccessTokensMemCache).clear(); // flush cache

	[(refreshTokenStorageOptions as MutableSome<UserSessionRedisStorageOptions, 'serializer'>).serializer] = pickRandom(
		[AVRO_SERIALIZER, FAST_JSON_SERIALIZER, JSON_SERIALIZER],
		{ count: 1 }
	);
});

afterAll(async function testEnvCleaner(): Promise<void> {
	if (serverAddress) {
		await server.close();
		logger.debug('Fastify server closed');
	}

	if (redisMemoryServer) {
		logger.info(`Stopping redis memory sever`);
		await redisMemoryServer.stop();
	} else {
		logger.debug(`Redis container was not created by 'before' hook. Therefore, cleanup is not needed.`);
	}

	await RedisClientInstance.disconnect(false);
}, 10_000);

export { serverAddress };
