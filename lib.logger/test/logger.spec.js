import { describe, it } from 'mocha';
import { chai } from './chai';
import { Logger } from '../lib/logger/logger';

describe('Logger spec', () => {
	const { expect } = chai;

	it('returns logging managers', () => {
		const instance = new Logger();
		expect(instance.formatting).to.not.be.equal(undefined);
		expect(instance.console).to.not.be.equal(undefined);
		expect(instance.file).to.not.be.equal(undefined);
		expect(instance.graylog2).to.not.be.equal(undefined);
	});

	it('throws when getting logger if bad configuration', () => {
		expect(() => new Logger().for('realsys')).to.throw('No transports for realsys');
	});

	it('creates logger for system, then caches it', () => {
		const logger = new Logger();
		logger.graylog2.register('input', { host: 'fake', port: 1 });
		logger.graylog2.recipeFor('realsys', { level: 'fake', input: 'input' });
		let begin;
		let end;

		begin = new Date();
		const loggerFirst = logger.for('realsys');
		end = new Date();
		const durationFirst = end - begin;

		begin = new Date();
		const loggerCached = logger.for('realsys');
		end = new Date();
		const durationCached = end - begin;

		expect(durationFirst > durationCached).to.be.equal(true);
		expect(loggerFirst).to.be.deep.equal(loggerCached);
	});

	it("can't alter created logger object", () => {
		const logger = new Logger();
		logger.console.setConfig({ level: 'info' });
		const instance = logger.for('realsys');
		expect(() => {
			instance.log = () => {};
		}).to.throw('Cannot add property log, object is not extensible');
	});
});
