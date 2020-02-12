import { before, after, beforeEach, afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import Dockerode, { Container } from 'dockerode';
import LoggerInstance, { FormattingManager } from '@marin/lib.logger/lib';
import { chrono } from '@marin/lib.utils';
import { initRedisClient, shutdownRedisClient } from '../lib';

describe('redis spec', () => {
	const docker = new Dockerode({
		socketPath: '/var/run/docker.sock'
	});
	const redisIp = '127.0.0.1';
	const redisExternalPort = 7001;
	const redisInternalPort = 6379;

	let container: Container;
	let containerNeedsToBeStopped = true;

	let expectedErrCodeOnUncaughtException: string | null = null;

	process
		.on('unhandledRejection', (reason, p) => {
			console.error(reason, 'Unhandled Rejection at Promise', p);
		})
		.on('uncaughtException', error => {
			console.error('uncaught exception', error, 'expected code', expectedErrCodeOnUncaughtException);
			// @ts-ignore
			expect(error.code).to.be.eq(expectedErrCodeOnUncaughtException);
		});

	before(async function() {
		this.timeout(10000);

		const images = await docker.listImages();
		if (images.findIndex(image => image.RepoTags.includes('redis:latest')) === -1) {
			throw new Error('Redis image not found. Install it then rerun tests');
		}

		LoggerInstance.console.setConfig({ level: 'debug' });
		LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);

		container = await docker.createContainer({
			Image: 'redis',
			AttachStdin: false,
			AttachStdout: true,
			AttachStderr: true,
			Tty: true,
			OpenStdin: false,
			StdinOnce: false,
			HostConfig: {
				PortBindings: {
					[`${redisInternalPort}/tcp`]: [
						{
							HostPort: `${redisExternalPort}`
						}
					]
				}
			}
		});
	});

	after(async function() {
		this.timeout(10000);
		await container.remove();
	});

	beforeEach(async function(): Promise<void> {
		this.timeout(10000);
		await container.start();
	});

	afterEach(async function() {
		if (containerNeedsToBeStopped) {
			this.timeout(10000);
			await container.stop();
		}
		containerNeedsToBeStopped = true;
		expectedErrCodeOnUncaughtException = null;
	});

	it('fails to connect to redis when server is down', async () => {
		await container.stop();
		await chrono.sleep(200);

		let err;
		try {
			await initRedisClient({
				host: redisIp,
				port: redisExternalPort
			});
		} catch (e) {
			err = e;
		}
		expect(err.code).to.be.eq('CONNECTION_BROKEN');
		expect(err.message).to.be.eq('Redis connection in broken state: retry aborted.');

		await shutdownRedisClient();
		containerNeedsToBeStopped = false;
	}).timeout(3500);

	it('tries to reconnect when connection dropped', async () => {
		expectedErrCodeOnUncaughtException = 'CONNECTION_BROKEN';

		await initRedisClient(
			{
				host: redisIp,
				port: redisExternalPort,
				connect_timeout: 1000 * 60 * 60,
				max_attempts: 10,
				retry_max_delay: 3000
			},
			true,
			true
		);

		// second has no effect
		await initRedisClient(
			{
				host: redisIp,
				port: redisExternalPort,
				connect_timeout: 1000 * 60 * 60,
				max_attempts: 10,
				retry_max_delay: 3000
			},
			true,
			true
		);
		await chrono.sleep(1000);

		await container.stop();
		await container.start();

		await chrono.sleep(2000);

		await shutdownRedisClient(false);
	}).timeout(10000);
});
