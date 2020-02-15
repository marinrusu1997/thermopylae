import { before } from 'mocha';
import LoggerInstance, { FormattingManager } from '@marin/lib.logger/lib';
import Dockerode from 'dockerode';
import { expect } from 'chai';

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

let expectedErrCodeOnUncaughtException: string | null = null;
function expectErrCodeOnUncaughtException(code: string | null): void {
	expectedErrCodeOnUncaughtException = code;
}

process
	.on('unhandledRejection', (reason, p) => {
		console.error(reason, 'Unhandled Rejection at Promise', p);
	})
	.on('uncaughtException', error => {
		console.error('uncaught exception', error, 'expected code', expectedErrCodeOnUncaughtException);
		// @ts-ignore
		expect(error.code).to.be.eq(expectedErrCodeOnUncaughtException);
	});

export { docker, assertImageAvailability, expectErrCodeOnUncaughtException };
