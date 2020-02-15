import { before } from 'mocha';
import LoggerInstance, { FormattingManager } from '@marin/lib.logger/lib';
import Dockerode from 'dockerode';

// eslint-disable-next-line import/no-mutable-exports
let docker: Dockerode;

before(() => {
	LoggerInstance.console.setConfig({ level: 'debug' });
	LoggerInstance.formatting.applyOrderFor(FormattingManager.OutputFormat.PRINTF, true);

	docker = new Dockerode({
		socketPath: '/var/run/docker.sock'
	});
});

async function assertImageAvailability(imageName: string): Promise<void> {
	const images = await docker.listImages();
	if (images.findIndex(image => image.RepoTags.includes(imageName)) === -1) {
		throw new Error(`${imageName} image not found. Install it then rerun tests.`);
	}
}

export { docker, assertImageAvailability };
