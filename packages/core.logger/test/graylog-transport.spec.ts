import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import { log, logError } from './utils';
import { FormattingManager, OutputFormat } from '../lib/formatting-manager';
import { GrayLogsManager } from '../lib/transports/graylog';

const inputsEndpoints = [
	{ host: '127.0.0.1', port: 12201 },
	{ host: '127.0.0.1', port: 12202 }
];

describe(`${GrayLogsManager.name} spec`, () => {
	it('registers inputs and provides transports for them', async () => {
		const graylog = new GrayLogsManager();
		const formatter = new FormattingManager();

		formatter.setDefaultFormattingOrder(OutputFormat.PRINTF);

		graylog.register('Test1', inputsEndpoints[0]);
		graylog.register('Test2', inputsEndpoints[1]);

		/* system1 uses his own recipe */
		graylog.setChannel('system1', {
			input: 'Test1',
			level: 'debug'
		});
		/* system2 uses @all recipe */
		graylog.setChannel('@all', {
			input: 'Test2',
			level: 'info'
		});
		await logError(formatter.formatterFor('system1'), graylog.get('system1')!, 'something went really wrong: %o', new Error('err msg1'));
		await log(formatter.formatterFor('system2'), graylog.get('system2')!, {
			level: 'warn',
			message: 'testing warn2'
		});
		await log(formatter.formatterFor('system2'), graylog.get('system2')!, {
			level: 'silly',
			message: 'testing silly2'
		});
	});

	it('registers input only once', () => {
		const graylog = new GrayLogsManager();
		graylog.register('Test1', inputsEndpoints[0]);
		const throwable = () => graylog.register('Test1', inputsEndpoints[1]);
		expect(throwable).to.throw(`Test1 has been registered already with ${JSON.stringify(inputsEndpoints[0])}.`);
	});

	it('registers channel only once', () => {
		const graylog = new GrayLogsManager();
		graylog.setChannel('@all', {
			input: 'Test2',
			level: 'info'
		});
		function throwable() {
			graylog.setChannel('@all', {
				input: 'Test2',
				level: 'debug'
			});
		}
		expect(throwable).to.throw(`@all has been registered already with ${JSON.stringify({ input: 'Test2', level: 'info' })}.`);
	});

	it('returns null when no inputs configured, graylog2 being not used', () => {
		expect(new GrayLogsManager().get('fakesys')).to.be.equal(null);
	});

	it('removes recipe for system once called, to prevent duplicate transports', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		instance.setChannel('realsys', {
			input: 'input',
			level: 'info'
		});
		instance.get('realsys');
		expect(() => instance.get('realsys')).to.throw("Neither '@all' recipe, nor 'realsys' recipe were configured.");
	});

	it('throws when not recipes configured', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		expect(() => instance.get('fakesys')).to.throw('No channels configured.');
	});

	it('throws when no recipe found, nor for system, nor for @all', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		instance.setChannel('realsys', {
			input: "does not matter, won't get there",
			level: 'fake'
		});
		expect(() => instance.get('fakesys')).to.throw("Neither '@all' recipe, nor 'fakesys' recipe were configured.");
	});

	it('throws when no graylog2 endpoint from recipe found', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		instance.setChannel('@all', {
			level: 'info',
			input: 'fake'
		});
		expect(() => instance.get('fakesys')).to.throw('Graylog2 endpoint for input fake not configured');
	});
});
