import { chrono } from '@thermopylae/lib.utils';
import Dockerode from 'dockerode';
import type { Container, ContainerInfo, Image, Port } from 'dockerode';
// @ts-ignore This package has no typings
import { Host } from 'netmap';
import { IncomingMessage } from 'http';
import { logger } from '../logger';

type ServicePortExtractor = (port: Port) => boolean;

interface ConnectionDetails {
	host: string;
	port: number;
	password: string;
}

let DockerodeInstance: Dockerode;
function getDockerodeInstance(): Dockerode {
	if (DockerodeInstance == null) {
		DockerodeInstance = new Dockerode({
			socketPath: process.env['DOCKER_SOCKET_PATH'] || '/var/run/docker.sock'
		});
	}
	return DockerodeInstance;
}

async function retrievePreviouslyCreatedContainer(
	containerInfos: Array<ContainerInfo>,
	containerName: string,
	extractServicePort: ServicePortExtractor
): Promise<Container | null> {
	for (let i = containerInfos.length - 1; i >= 0; i--) {
		if (containerInfos[i].Names.includes(`/${containerName}`)) {
			logger.debug(`Found container ${containerName} created in previous run in ${containerInfos[i].State} state.`);
			// eslint-disable-next-line no-await-in-loop
			const container = await getDockerodeInstance().getContainer(containerInfos[i].Id);

			if (containerInfos[i].State !== 'running') {
				logger.debug(`Starting container ${containerName}.`);
				// eslint-disable-next-line no-await-in-loop
				await container.start();
			}

			let containerListeningInterface;
			for (let j = containerInfos[i].Ports.length - 1; j >= 0; j--) {
				containerListeningInterface = containerInfos[i].Ports[j];

				if (extractServicePort(containerListeningInterface)) {
					logger.debug(
						`Service from container ${containerName} is listening on ${containerListeningInterface.IP}:${containerListeningInterface.PublicPort}`
					);
					break;
				}
			}

			return container;
		}
	}
	return null;
}

async function pullMissingImage(imageName: string): Promise<void> {
	const images = await getDockerodeInstance().listImages();
	const imageIndex = images.findIndex((image) => {
		if (image.RepoTags != null) {
			return image.RepoTags.includes(imageName);
		}
		return false;
	});

	if (imageIndex === -1) {
		logger.debug(`Pulling image ${imageName}.`);
		const image = (await getDockerodeInstance().pull(imageName, {})) as Image | IncomingMessage;

		if (image instanceof IncomingMessage) {
			await readIncomingMessage(image);
		}

		logger.debug(`Image ${imageName} created. Waiting 200 ms for availability.`);
		await chrono.sleep(200);
	}
}

function readIncomingMessage(stream: IncomingMessage): Promise<void> {
	return new Promise((resolve, reject) => {
		DockerodeInstance.modem.followProgress(
			stream,
			(err: Error | null) => {
				return err ? reject(err) : resolve();
			},
			() => {
				return undefined;
			}
		);
	});
}

async function serviceAvailability(host: string, port: number, attempts: number): Promise<void> {
	while ((await serviceAvailability.getStatus(host, port)) !== 'open' && attempts--) {
		logger.debug(`Service availability on ${host}:${port} remaining attempts ${attempts}.`);
		await chrono.sleep(1000);
	}
	if (attempts <= 0) {
		throw new Error(`Service at ${host}:${port} is not available.`);
	}
}
serviceAvailability.getStatus = async function (host: string, port: number): Promise<'open' | 'closed'> {
	const nmapHost = new Host(host);
	const [portInfo] = await nmapHost.scanPorts([port]);
	return portInfo && portInfo.open ? 'open' : 'closed';
};

export { getDockerodeInstance, retrievePreviouslyCreatedContainer, pullMissingImage, serviceAvailability };
export type { ServicePortExtractor, ConnectionDetails };
