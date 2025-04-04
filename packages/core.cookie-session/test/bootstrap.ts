import * as crypto from 'node:crypto';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { ClientModule, CoreModule, DevModule } from '@thermopylae/core.declarations';
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import {
	ConnectionType,
	type DebuggableEventType,
	RedisClientInstance,
	type RedisConnectionOptions,
	initLogger as initRedisClientLogger
} from '@thermopylae/core.redis';
import { initLogger as initUserSessionCommonsLogger } from '@thermopylae/core.user-session.commons';
import { logger } from '@thermopylae/dev.unit-test';
import type { Server } from 'http';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { initLogger as initCoreCookieSessionLogger } from '../lib/logger.js';
import { app } from './fixtures/server.js';

const PORT = 7569;

let redisContainer: StartedRedisContainer;
let server: Server;

beforeAll(async function boot() {
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
	LoggerManagerInstance.console.createTransport({ level: 'debug' });

	initRedisClientLogger();
	initCoreCookieSessionLogger();
	initUserSessionCommonsLogger();

	const password = crypto.randomBytes(5).toString('hex');
	redisContainer = await new RedisContainer('redis:latest').withPassword(password).start();

	const redisClientOptions: RedisConnectionOptions = {
		host: redisContainer.getHost(),
		port: redisContainer.getFirstMappedPort(),
		password,
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

	logger.error('Refresh token storage has serialization schemas to user session metadata, which needs to be updated from time to time.');
}, 120_000);

beforeEach(async () => {
	await RedisClientInstance.client.flushall(); // flush storage
});

afterAll(async function testEnvCleaner(): Promise<void> {
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

	if (redisContainer) {
		logger.info(`Stopping redis container`);
		await redisContainer.stop();
	} else {
		logger.debug(`Redis container was not created by 'before' hook. Therefore, cleanup is not needed.`);
	}

	await RedisClientInstance.disconnect(false);
}, 10_000);

export { PORT };
