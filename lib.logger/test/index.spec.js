import { describe, it } from 'mocha';
import { chai } from './chai';
import LoggerInstance from '../lib';

describe('Lib spec', () => {
	const { expect } = chai;

	it('exports a Logger singleton', () => {
		expect(() => new LoggerInstance()).to.throw('LoggerInstance is not a constructor');
	});
});
