// eslint-disable-next-line import/no-extraneous-dependencies
import { before } from 'mocha';
import { initLogger } from '@thermopylae/dev.unit-test';
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { DevModule } from '@thermopylae/core.declarations';

before(() => {
	/* LOGGING */
	LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[DevModule.UNIT_TESTING]: 'debug'
		}
	});
	LoggerManagerInstance.console.createTransport({ level: 'debug' });

	initLogger();
});
