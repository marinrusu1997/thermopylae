import { before } from 'mocha';
import { initLogger } from '@thermopylae/lib.unit-test';
import { DefaultFormatters, LoggerInstance, OutputFormat } from '@thermopylae/core.logger';
import { Library } from '@thermopylae/core.declarations';

before(() => {
	/* LOGGING */
	LoggerInstance.formatting.setDefaultRecipe(OutputFormat.PRINTF, {
		colorize: true,
		skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
		levelForLabel: {
			[Library.UNIT_TEST]: 'debug'
		}
	});
	LoggerInstance.console.createTransport({ level: 'debug' });

	initLogger();
});
