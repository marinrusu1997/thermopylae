import { number } from '@thermopylae/lib.utils';
import type { Container, Port } from 'dockerode';
import type { ConnectionDetails } from './index';
import { serviceAvailability, getDockerodeInstance, pullMissingImage, retrievePreviouslyCreatedContainer } from './index';
import { logger } from '../logger';

const PRIVATE_PORT = 6379;
const CONTAINER_NAME = 'redis_test';
const IMAGE_NAME = 'bitnami/redis:latest';

const CONNECTION_DETAILS: ConnectionDetails = {
	host: '127.0.0.1',
	port: number.randomInt(5000, 6000),
	password: 'thermopylae'
};

function extractRedisServerPort(containerPort: Port): boolean {
	if (containerPort.PrivatePort === PRIVATE_PORT && typeof containerPort.PublicPort === 'number') {
		CONNECTION_DETAILS.port = containerPort.PublicPort;
		return true;
	}
	return false;
}

async function bootRedisContainer(): Promise<[Container, ConnectionDetails]> {
	const containerInfos = await getDockerodeInstance().listContainers({
		all: true
	});

	let container = await retrievePreviouslyCreatedContainer(containerInfos, CONTAINER_NAME, extractRedisServerPort);

	if (container == null) {
		await pullMissingImage(IMAGE_NAME);

		logger.debug('Creating Redis container.');

		container = await getDockerodeInstance().createContainer({
			Image: IMAGE_NAME,
			name: CONTAINER_NAME,
			Cmd: ['/opt/bitnami/scripts/redis/run.sh', '--loglevel', 'debug', '--always-show-logo', 'no', '--maxmemory', '100mb'],
			Env: ['REDIS_AOF_ENABLED=no', `REDIS_PASSWORD=${CONNECTION_DETAILS.password}`, `ALLOW_EMPTY_PASSWORD=false`],
			HostConfig: {
				PortBindings: {
					[`${PRIVATE_PORT}/tcp`]: [
						{
							HostIp: CONNECTION_DETAILS.host,
							HostPort: `${CONNECTION_DETAILS.port}`
						}
					]
				}
			}
		});

		logger.debug(`Starting Redis container ${container.id}`);
		await container.start();
	}

	logger.debug(`Awaiting redis service availability on ${CONNECTION_DETAILS.host}:${CONNECTION_DETAILS.port}`);
	await serviceAvailability(CONNECTION_DETAILS.host, CONNECTION_DETAILS.port, 10);

	Object.freeze(CONNECTION_DETAILS);
	return [container, CONNECTION_DETAILS];
}

export { bootRedisContainer };
