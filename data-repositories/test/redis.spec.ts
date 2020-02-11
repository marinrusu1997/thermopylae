import { before, after, beforeEach, afterEach, describe, it } from 'mocha';
import Dockerode, { Container } from 'dockerode';
import LoggerInstance, { FormattingManager } from '@marin/lib.logger/lib';
import { initRedisClient, shutdownRedisClient } from '../lib';

describe('redis spec', () => {
	const docker = new Dockerode({
		socketPath: '/var/run/docker.sock'
	});
	const redisIp = '127.0.0.1';
	const redisExternalPort = 7001;
	const redisInternalPort = 6379;
	let container: Container;

	before(async () => {
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
		this.timeout(10000);
		await container.stop();
	});

	it('connects to redis', async () => {
		await initRedisClient(
			{
				host: redisIp,
				port: redisExternalPort
			},
			true,
			true
		);
		await shutdownRedisClient();
	});
});
