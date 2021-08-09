import { after, before, beforeEach } from 'mocha';
import { bootRedisContainer, ConnectionDetails, DockerContainer, initLogger as initUnitTestLogger, logger } from '@thermopylae/dev.unit-test';
import { ConnectionType, DebuggableEventType, initLogger as initRedisClientLogger, RedisClientInstance, RedisConnectionOptions } from '@thermopylae/core.redis';
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { ClientModule, CoreModule, DevModule } from '@thermopylae/core.declarations';
import { config as dotEnvConfig } from 'dotenv';
import { initLogger as initUserSessionCommonsLogger } from '@thermopylae/core.user-session.commons';
import type { Server } from 'http';
import { initLogger as initCoreCookieSessionLogger } from '../lib/logger';
import { app } from './fixtures/server';

const PORT = 7569;

let redisContainer: DockerContainer;
let server: Server;

before(async function boot() {
	this.timeout(120_000);

	const dotEnv = dotEnvConfig();
	if (dotEnv.error) {
		throw dotEnv.error;
	}

	LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[CoreModule.COOKIE_USER_SESSION]: 'info',
			[CoreModule.USER_SESSION_COMMONS]: 'info',
			[DevModule.UNIT_TESTING]: 'error',
			[ClientModule.REDIS]: 'error'
		}
	});
	LoggerManagerInstance.console.createTransport({ level: process.env['LOG_LEVEL'] || 'debug' });

	initUnitTestLogger();
	initRedisClientLogger();
	initCoreCookieSessionLogger();
	initUserSessionCommonsLogger();

	let connectDetails: ConnectionDetails;
	[redisContainer, connectDetails] = await bootRedisContainer();

	const redisClientOptions: RedisConnectionOptions = {
		...connectDetails,
		connect_timeout: 10_000,
		max_attempts: 10,
		retry_max_delay: 5_000,
		attachDebugListeners: new Set<DebuggableEventType>(['end', 'reconnecting'])
	};

	await RedisClientInstance.connect({
		[ConnectionType.REGULAR]: {
			...redisClientOptions,
			detect_buffers: true
		},
		[ConnectionType.SUBSCRIBER]: redisClientOptions
	});

	await RedisClientInstance.client.config('SET', 'notify-keyspace-events', 'Kgxe');

	await new Promise<void>((resolve) => {
		server = app.listen(PORT, () => {
			logger.debug(`Express server listening on http://localhost:${PORT}`);
			resolve();
		});
	});

	logger.crit('Refresh token storage has serialization schemas to user session metadata, which needs to be updated from time to time.');
});

beforeEach(async () => {
	await RedisClientInstance.client.flushall(); // flush storage
});

after(async function testEnvCleaner(): Promise<void> {
	this.timeout(10_000);

	if (server) {
		await new Promise<void>((resolve, reject) => {
			server.close((err) => {
				if (err) {
					return reject(err);
				}

				logger.debug('Express server closed');
				resolve();
			});
		});
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

export { PORT };
