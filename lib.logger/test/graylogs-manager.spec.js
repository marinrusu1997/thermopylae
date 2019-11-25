import { describe, it } from 'mocha';
import { chai } from './chai';
import { log, error } from './utils';
import { FormattingManager } from '../lib/formatting/formatting-manager';
import { GrayLogsManager } from '../lib/transports/graylogs-manager';

describe('Graylogs manager spec', () => {
	const { expect } = chai;
	const inputsEndpoints = [{ host: '127.0.0.1', port: 12201 }, { host: '127.0.0.1', port: 12202 }];

	it('registers inputs and provides transports for them', async () => {
		const graylog = new GrayLogsManager();
		const formatter = new FormattingManager();
		graylog.register('Test1', inputsEndpoints[0]);
		graylog.register('Test2', inputsEndpoints[1]);
		/* system1 uses his own recipe */
		graylog.recipeFor('system1', {
			input: 'Test1',
			level: 'debug'
		});
		/* system2 uses @all recipe */
		graylog.recipeFor('@all', {
			input: 'Test2',
			level: 'info'
		});
		await error(
			formatter.formatterFor('system1'),
			graylog.get('system1'),
			'something went really wrong: %o',
			new Error('err msg1')
		);
		await log(formatter.formatterFor('system2'), graylog.get('system2'), {
			level: 'warn',
			message: 'testing warn2'
		});
		await log(formatter.formatterFor('system2'), graylog.get('system2'), {
			level: 'silly',
			message: 'testing silly2'
		});
	});

	it('returns null when no inputs configured, graylog2 being not used', () => {
		expect(new GrayLogsManager().get('fakesys')).to.be.equal(null);
	});

	it('removes recipe for system once called, to prevent duplicate transports', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		instance.recipeFor('realsys', {
			input: 'input',
			level: 'info'
		});
		instance.get('realsys');
		expect(() => instance.get('realsys')).to.throw('no @all recipe and no realsys recipe were configured');
	});

	it('throws when not recipes configured', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		expect(() => instance.get('fakesys')).to.throw('no recipes configured');
	});

	it('throws when no recipe found, nor for system, nor for @all', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		instance.recipeFor('realsys', {
			input: "does not matter, won't get there",
			level: 'fake'
		});
		expect(() => instance.get('fakesys')).to.throw('no @all recipe and no fakesys recipe were configured');
	});

	it('throws when no graylog2 endpoint from recipe found', () => {
		const instance = new GrayLogsManager();
		instance.register('input', inputsEndpoints[0]);
		instance.recipeFor('@all', {
			level: 'info',
			input: 'fake'
		});
		expect(() => instance.get('fakesys')).to.throw('Graylog2 endpoint for input fake not configured');
	});
});
