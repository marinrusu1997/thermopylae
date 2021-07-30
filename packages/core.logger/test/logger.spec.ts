import { describe, it } from 'mocha';
import { expect } from '@thermopylae/dev.unit-test';
import { Logger } from '../lib';

describe('Logger spec', () => {
	it('returns logging managers', () => {
		const instance = new Logger();
		expect(instance.formatting).to.not.be.equal(undefined);
		expect(instance.console).to.not.be.equal(undefined);
		expect(instance.file).to.not.be.equal(undefined);
		expect(instance.graylog2).to.not.be.equal(undefined);
	});

	it('throws when getting logger if bad configuration', () => {
		expect(() => new Logger().for('realsys')).to.throw('No transports were configured for realsys.');
	});

	it('creates logger for system, then does not cache it, but delegates this responsibility to the module which uses it', () => {
		const logger = new Logger();
		logger.graylog2.register('input', { host: 'fake', port: 1 });
		logger.graylog2.setChannel('realsys', { level: 'fake', input: 'input' });
		const loggerFirst = logger.for('realsys');
		logger.graylog2.setChannel('realsys', { level: 'fake', input: 'input' }); // register again, first get removed it
		const loggerSecond = logger.for('realsys');

		expect(loggerFirst).to.not.be.deep.equal(loggerSecond);
	});

	it("can't alter created logger object", () => {
		const logger = new Logger();
		logger.console.createTransport({ level: 'info' });
		const instance = logger.for('realsys');
		expect(() => {
			// @ts-ignore
			instance.log = null;
		}).to.throw('Cannot add property log, object is not extensible');
	});
});
